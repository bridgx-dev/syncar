import {
    type ChannelName,
    type Message,
    type IMiddleware,
    type IServerTransport,
    MessageType,
} from './types'

/**
 * Server configuration options
 */
export interface IServerOptions {
    server?: import('node:http').Server
    port?: number
    host?: string
    path?: string
    transport?: IServerTransport
    enablePing?: boolean
    pingInterval?: number
    pingTimeout?: number
    registry?: ClientRegistry
    middleware?: IMiddleware[]
    broadcastChunkSize?: number
}

/**
 * Server statistics
 */
export interface IServerStats {
    clientCount: number
    channelCount: number
    subscriptionCount: number
    startedAt?: number
}

import { MulticastChannel, BroadcastChannel } from './channel'
import { ConnectionHandler, MessageHandler, SignalHandler } from './handlers'
import { ContextManager } from './context'
import { StateError, ConfigError } from './errors'
import { ClientRegistry } from './registry'
import { WebSocketServerTransport } from './websocket'
import { DEFAULT_SERVER_CONFIG, DEFAULT_MAX_PAYLOAD } from './config'

interface ServerState {
    started: boolean
    startedAt: number | undefined
}

export class SynnelServer {
    private readonly config: IServerOptions
    private transport: IServerTransport | undefined
    public readonly registry: ClientRegistry
    private readonly context: ContextManager
    private readonly status: ServerState = {
        started: false,
        startedAt: undefined,
    }
    private connectionHandler: ConnectionHandler | undefined
    private messageHandler: MessageHandler | undefined
    private signalHandler: SignalHandler | undefined
    private broadcastChannel: BroadcastChannel<unknown> | undefined

    constructor(config: IServerOptions) {
        this.config = config

        // Create or use injected client registry
        this.registry = this.config.registry ?? new ClientRegistry()

        // Create context manager
        this.context = new ContextManager()

        // Register any middleware from config
        if (this.config.middleware) {
            for (const mw of this.config.middleware) {
                this.context.use(mw)
            }
        }
    }

    async start(): Promise<void> {
        if (this.status.started) {
            throw new StateError('Server is already started')
        }

        // Use provided transport or throw error
        if (this.config.transport) {
            this.transport = this.config.transport
        } else {
            throw new ConfigError(
                'Transport must be provided in config or use createSynnelServer factory',
            )
        }

        // Create handlers
        this.connectionHandler = new ConnectionHandler({ registry: this.registry })
        this.messageHandler = new MessageHandler({ registry: this.registry, context: this.context })
        this.signalHandler = new SignalHandler({ registry: this.registry, context: this.context })

        // Set up transport event handlers
        this.setupTransportHandlers()

        // Create broadcast channel and register it
        this.broadcastChannel = new BroadcastChannel(this.registry, this.config.broadcastChunkSize)
        this.registry.registerChannel(this.broadcastChannel)

        // Update state
        this.status.started = true
        this.status.startedAt = Date.now()
    }

    async stop(): Promise<void> {
        if (!this.status.started || !this.transport) {
            return // Already stopped
        }

        // Clear handlers
        this.connectionHandler = undefined
        this.messageHandler = undefined
        this.signalHandler = undefined

        // Clear channels from registry
        this.registry.clear()
        this.broadcastChannel = undefined

        // Update state
        this.status.started = false
        this.status.startedAt = undefined
    }

    createBroadcast<T = unknown>(): BroadcastChannel<T> {
        if (!this.status.started || !this.broadcastChannel) {
            throw new StateError('Server must be started before creating channels')
        }
        return this.broadcastChannel as BroadcastChannel<T>
    }

    createMulticast<T = unknown>(name: ChannelName): MulticastChannel<T> {
        if (!this.status.started || !this.transport) {
            throw new StateError('Server must be started before creating channels')
        }

        const existing = this.registry.getChannel<T>(name) as MulticastChannel<T> | undefined
        if (existing) return existing

        const channel = new MulticastChannel<T>({
            name,
            registry: this.registry,
            options: {
                chunkSize: this.config.broadcastChunkSize,
            },
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.registry.registerChannel(channel as any)
        return channel
    }

    hasChannel(name: ChannelName): boolean {
        return !!this.registry.getChannel(name)
    }

    getChannels(): ChannelName[] {
        return this.registry.getChannels()
    }

    use(middleware: IMiddleware): void {
        this.context.use(middleware)
    }

    getStats(): IServerStats {
        return {
            startedAt: this.status.startedAt,
            clientCount: this.registry.getCount(),
            channelCount: this.registry.getChannels().length,
            subscriptionCount: this.registry.getTotalSubscriptionCount(),
        }
    }

    getConfig(): Readonly<IServerOptions> {
        return this.config
    }

    getRegistry(): ClientRegistry {
        return this.registry
    }

    private setupTransportHandlers(): void {
        const transport = this.transport!

        transport.on('connection', async (connection) => {
            try {
                await this.context.executeConnection(connection, 'connect')
                await this.connectionHandler!.handleConnection(connection)
            } catch (error) {
                console.error('Error handling connection:', error)
            }
        })

        transport.on('disconnection', async (clientId) => {
            try {
                const client = this.registry.get(clientId)
                if (client) {
                    await this.context.executeConnection(client, 'disconnect')
                    await this.connectionHandler!.handleDisconnection(clientId)
                }
            } catch (error) {
                console.error('Error handling disconnection:', error)
            }
        })

        transport.on('message', async (clientId: string, message: Message) => {
            try {
                const client = this.registry.get(clientId)
                if (!client) return

                if (message.type === MessageType.DATA) {
                    await this.messageHandler!.handleMessage(client, message)
                } else if (message.type === MessageType.SIGNAL) {
                    await this.signalHandler!.handleSignal(client, message)
                }
            } catch (error) {
                console.error('Error handling message:', error)
            }
        })

        transport.on('error', (error: Error) => {
            console.error('Transport error:', error)
        })
    }
}

/**
 * Create a Synnel server with automatic WebSocket transport setup
 *
 * @param config - Server configuration options
 * @returns Configured Synnel server instance
 *
 * @example
 * ```ts
 * const server = createSynnelServer({ port: 3000 })
 * await server.start()
 * ```
 */
export function createSynnelServer(config: IServerOptions = {}): SynnelServer {
    // Merge defaults
    const serverConfig: IServerOptions = {
        ...DEFAULT_SERVER_CONFIG,
        middleware: [],
        ...config,
    }

    // Ensure registry exists
    const registry = serverConfig.registry ?? new ClientRegistry()
    serverConfig.registry = registry

    let transport: IServerTransport

    if (serverConfig.transport) {
        transport = serverConfig.transport
    } else {
        if (!serverConfig.server) {
            import('node:http').then((http) => {
                const httpServer = http.createServer()
                httpServer.listen(serverConfig.port, serverConfig.host)
                serverConfig.server = httpServer
            })
        }

        transport = new WebSocketServerTransport({
            server: serverConfig.server as unknown,
            path: serverConfig.path,
            maxPayload: (config as { maxPayload?: number }).maxPayload ?? DEFAULT_MAX_PAYLOAD,
            enablePing: serverConfig.enablePing,
            pingInterval: serverConfig.pingInterval,
            pingTimeout: serverConfig.pingTimeout,
            connections: registry.connections,
        })
    }

    return new SynnelServer({ ...serverConfig, transport })
}
