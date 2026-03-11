import {
    type ChannelName,
    type Message,
    type IMiddleware,
    MessageType,
    ILogger,
} from './types'
import { StateError } from './errors'
import { ContextManager } from './context'
import { ClientRegistry } from './registry'
import { Channel, ChannelOptions } from './channel'
import { WebSocketServerTransport } from './websocket'
import { createDefaultLogger, publishMessage } from './utils'
import { DEFAULT_SERVER_CONFIG, DEFAULT_MAX_PAYLOAD } from './config'
import { ConnectionHandler, MessageHandler, SignalHandler } from './handlers'

interface ServerState {
    started: boolean
    startedAt: number | undefined
}

export interface IServerStats {
    /** Number of currently connected clients */
    clientCount: number
    /** Number of active channels */
    channelCount: number
    /** Total number of channel subscriptions across all channels */
    subscriptionCount: number
    /** Unix timestamp (ms) when the server was started */
    startedAt?: number
}

/**
 * Server configuration options
 * @see {@link DEFAULT_SERVER_CONFIG} for default values
 */
export interface IServerOptions {
    /**
     * HTTP or HTTPS server instance
     *
     * @remarks
     * If provided, the WebSocket server will attach to this existing server.
     * If not provided, a new HTTP server will be created automatically.
     */
    server?: import('node:http').Server | import('node:https').Server

    /**
     * Custom logger instance
     *
     * @remarks
     * Logger conforming to the {@link ILogger} interface. Used for
     * debugging, error reporting, and operational monitoring.
     */
    logger: ILogger

    /**
     * Port to listen on (default: 3000)
     *
     * @remarks
     * Only used when creating a new HTTP server. Ignored if `server`
     * option is provided.
     */
    port: number

    /**
     * Host to bind to (default: '0.0.0.0')
     *
     * @remarks
     * Determines which network interface the server listens on.
     * Use 'localhost' for local-only access or '0.0.0.0' for all interfaces.
     */
    host: string

    /**
     * WebSocket path (default: '/syncar')
     *
     * @remarks
     * The URL path for WebSocket connections. Clients must connect to
     * `ws://host:port/path` to establish a connection.
     */
    path: string

    /**
     * Transport implementation
     *
     * @remarks
     * Custom WebSocket transport layer. Defaults to {@link WebSocketServerTransport}
     * if not provided. Allows for custom transport implementations.
     */
    transport: WebSocketServerTransport

    /**
     * Enable automatic ping/pong (default: true)
     *
     * @remarks
     * When enabled, the server sends periodic ping frames to detect
     * dead connections and maintain keep-alive.
     */
    enablePing: boolean

    /**
     * Ping interval in ms (default: 30000)
     *
     * @remarks
     * Time between ping frames when `enablePing` is true.
     * Lower values detect dead connections faster but increase bandwidth.
     */
    pingInterval: number

    /**
     * Ping timeout in ms (default: 5000)
     *
     * @remarks
     * Time to wait for pong response before closing connection.
     * Should be significantly less than `pingInterval`.
     */
    pingTimeout: number

    /**
     * Client registry instance
     *
     * @remarks
     * Shared registry for tracking clients and subscriptions.
     * Allows multiple server instances to share state.
     */
    registry: ClientRegistry

    /**
     * Global middleware chain
     *
     * @remarks
     * Middleware functions applied to all actions before channel-specific middleware.
     * Executed in the order they are defined.
     *
     * @example
     * ```ts
     * middleware: [
     *   authenticate({ verifyToken }),
     *   logger(),
     *   rateLimit({ maxRequests: 100 })
     * ]
     * ```
     */
    middleware: IMiddleware[]

    /**
     * Chunk size for large broadcasts (default: 500)
     *
     * @remarks
     * When broadcasting to more than this many clients, messages are sent
     * in chunks to avoid blocking the event loop. Lower values reduce latency
     * per chunk but increase total broadcast time.
     */
    chunkSize: number
}

/**
 * Syncar Server - Real-time WebSocket server with pub/sub channels
 *
 * @example
 * ```ts
 * const server = createSyncarServer({ port: 3000 })
 * await server.start()
 *
 * const chat = server.createChannel('chat')
 * chat.publish('Hello!')
 * ```
 */
export class SyncarServer {
    private readonly config: IServerOptions
    private transport: WebSocketServerTransport | undefined
    public readonly registry: ClientRegistry
    private readonly context: ContextManager
    private readonly status: ServerState = {
        started: false,
        startedAt: undefined,
    }
    private connectionHandler: ConnectionHandler | undefined
    private messageHandler: MessageHandler | undefined
    private signalHandler: SignalHandler | undefined

    constructor(config: IServerOptions) {
        this.config = config

        // Use the injected client registry from options
        this.registry = this.config.registry

        // Create context manager
        this.context = new ContextManager()

        // Register any middleware from config
        if (this.config.middleware) {
            for (const mw of this.config.middleware) {
                this.context.use(mw)
            }
        }
    }

    /**
     * Start the server and begin accepting connections
     *
     * @remarks
     * Initializes the WebSocket transport layer, sets up event handlers,
     * and prepares the server for connections.
     *
     * @throws {StateError} If the server is already started
     *
     * @example
     * ```ts
     * const server = createSyncarServer({ port: 3000 })
     * server.start()
     * console.log('Server is running')
     * ```
     */
    start(): void {
        if (this.status.started) {
            throw new StateError('Server is already started')
        }

        // Use provided transport from config
        this.transport = this.config.transport

        // Create handlers
        this.connectionHandler = new ConnectionHandler({
            registry: this.registry,
        })
        this.messageHandler = new MessageHandler({
            registry: this.registry,
            context: this.context,
        })
        this.signalHandler = new SignalHandler({
            registry: this.registry,
            context: this.context,
        })

        // Set up transport event handlers
        this.setupTransportHandlers()

        // Update state
        this.status.started = true
        this.status.startedAt = Date.now()
    }

    /**
     * Stop the server and close all connections
     *
     * @remarks
     * Gracefully shuts down the server by clearing all handlers,
     * removing all channels, and allowing the transport layer to close.
     * Existing connections will be terminated.
     *
     * @example
     * ```ts
     * server.stop()
     * console.log('Server stopped')
     * ```
     */
    stop(): void {
        if (!this.status.started || !this.transport) {
            return // Already stopped
        }

        // Clear handlers
        this.connectionHandler = undefined
        this.messageHandler = undefined
        this.signalHandler = undefined

        // Clear channels from registry
        this.registry.clear()

        // Update state
        this.status.started = false
        this.status.startedAt = undefined
    }

    /**
     * Create or retrieve a channel
     *
     * @remarks
     * Unified channel creation.
     *
     * @template T - Type of data to be published on this channel (default: unknown)
     * @param name - Unique channel name
     * @param options - Channel configuration options
     * @returns The channel instance
     *
     * @throws {StateError} If the server hasn't been started yet
     *
     * @example
     * ### Default: bidirectional (chat room)
     * ```ts
     * const chat = server.createChannel('chat')
     * chat.onMessage((data, client) => {
     *   chat.publish(data, [client.id]) // Relay to others, excluding sender
     * })
     * ```
     */
    createChannel<T = unknown>(
        name: ChannelName,
        options?: ChannelOptions,
    ): Channel<T> {
        if (!this.status.started || !this.transport) {
            throw new StateError(
                'Server must be started before creating channels',
            )
        }

        // Check if channel already exists
        const existing = this.registry.getChannel<T>(name) as Channel<T>
        if (existing) return existing

        const channel = new Channel<T>({
            name,
            registry: this.registry,
            options,
            chunkSize: this.config.chunkSize,
        })

        this.registry.registerChannel(channel)
        return channel
    }

    /**
     * Check if a channel exists
     *
     * @param name - The channel name to check
     * @returns `true` if a channel with this name exists, `false` otherwise
     *
     * @example
     * ```ts
     * if (!server.hasChannel('chat')) {
     *   const chat = server.createChannel('chat')
     * }
     * ```
     */
    hasChannel(name: ChannelName): boolean {
        return !!this.registry.getChannel(name)
    }

    /**
     * Broadcast data to all connected clients
     *
     * @remarks
     * A convenience method to send data to every client currently connected
     * to the server. This uses the `publishInChunks` utility to efficiently
     * broadcast messages without blocking the event loop.
     *
     * @param data - The data to broadcast to all clients
     *
     * @example
     * ```ts
     * server.broadcast({
     *   type: 'announcement',
     *   content: 'Server update in progress'
     * })
     * ```
     */
    broadcast<T = unknown>(data: T): void {
        const connections = this.registry.getAll()
        publishMessage<T>({
            data,
            connections,
            chunkSize: this.config.chunkSize,
            channel: '__broadcast__',
        })
    }

    /**
     * Get all active channel names
     *
     * @returns Array of channel names currently registered on the server
     *
     * @example
     * ```ts
     * const channels = server.getChannels()
     * console.log('Active channels:', channels)
     * // ['chat', 'notifications', 'presence']
     * ```
     */
    getChannels(): ChannelName[] {
        return this.registry.getChannels()
    }

    /**
     * Register a global middleware
     *
     * @remarks
     * Adds a middleware function to the global middleware chain.
     * Global middleware runs before channel-specific middleware for all actions.
     *
     * @param middleware - The middleware function to register
     *
     * @example
     * ```ts
     * import { authenticate } from '@syncar/server'
     *
     * server.use(authenticate({
     *   verifyToken: async (token) => jwt.verify(token, SECRET)
     * }))
     * ```
     *
     * @see {@link IMiddleware} for middleware interface
     */
    use(middleware: IMiddleware): void {
        this.context.use(middleware)
    }

    /**
     * Get server statistics
     *
     * @returns Server statistics including client count, channel count,
     * subscription count, and start time
     * @see {@link IServerStats} for statistics structure
     */
    getStats(): IServerStats {
        return {
            startedAt: this.status.startedAt,
            clientCount: this.registry.getCount(),
            channelCount: this.registry.getChannels().length,
            subscriptionCount: this.registry.getTotalSubscriptionCount(),
        }
    }

    /**
     * Get the server configuration (read-only)
     *
     * @returns Readonly copy of the server configuration options
     */
    getConfig(): Readonly<IServerOptions> {
        return this.config
    }

    private setupTransportHandlers(): void {
        const transport = this.transport!

        transport.on('connection', async (connection) => {
            try {
                await this.context.executeConnection(connection, 'connect')
                await this.connectionHandler!.handleConnection(connection)
            } catch (error) {
                this.config.logger.error(
                    'Error handling connection:',
                    error as Error,
                )
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
                this.config.logger.error(
                    'Error handling disconnection:',
                    error as Error,
                )
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
                this.config.logger.error((error as Error).message)
            }
        })

        transport.on('error', (error: Error) => {
            this.config.logger.error(error.message)
        })
    }
}

/**
 * Create a Syncar server with automatic WebSocket transport setup
 *
 * @param config - Optional partial server configuration
 * @returns Configured Syncar server instance
 *
 * @example
 * ```ts
 * const server = createSyncarServer({ port: 3000 })
 * server.start()
 * ```
 */
export function createSyncarServer(
    config: Partial<IServerOptions> = {},
): SyncarServer {
    // Ensure registry exists
    const registry = config.registry ?? new ClientRegistry()
    const logger = config.logger ?? createDefaultLogger()

    // Merge defaults
    const serverOptions: IServerOptions = {
        ...DEFAULT_SERVER_CONFIG,
        middleware: [],
        ...config,
        registry,
        logger,
    } as IServerOptions

    if (!serverOptions.transport) {
        if (!serverOptions.server) {
            import('node:http').then((http) => {
                const httpServer = http.createServer()
                httpServer.listen(serverOptions.port, serverOptions.host)
                serverOptions.server = httpServer
            })
        }

        serverOptions.transport = new WebSocketServerTransport({
            server: serverOptions.server,
            path: serverOptions.path,
            maxPayload:
                (config as { maxPayload?: number }).maxPayload ??
                DEFAULT_MAX_PAYLOAD,
            enablePing: serverOptions.enablePing,
            pingInterval: serverOptions.pingInterval,
            pingTimeout: serverOptions.pingTimeout,
            connections: registry.connections,
        })
    }

    return new SyncarServer(serverOptions)
}
