import type {
  IServerConfig,
  ISynnelServer,
  IServerStats,
  IServerTransport,
  IClientRegistry,
  IBroadcastTransport,
  IMulticastTransport,
  ChannelName,
  Message,
  DataMessage,
  SignalMessage,
  IMiddleware,
  IMiddlewareManager,
} from '../types'
import { ClientRegistry } from '../registry'
import { ChannelRef } from '../channel/channel-ref'
import { BroadcastChannel } from '../channel'
import { ConnectionHandler } from '../handlers'
import { MessageHandler } from '../handlers'
import { SignalHandler } from '../handlers'
import { MiddlewareManager } from '../middleware/middleware-manager'
import { StateError, ConfigError } from '../errors'

interface ServerState {
  started: boolean
  startedAt: number | undefined
}

export class SynnelServer implements ISynnelServer {
  private readonly config: Required<IServerConfig>
  private transport: IServerTransport | undefined
  public readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly status: ServerState = {
    started: false,
    startedAt: undefined,
  }
  private connectionHandler: ConnectionHandler | undefined
  private messageHandler: MessageHandler | undefined
  private signalHandler: SignalHandler | undefined

  private broadcastChannel: IBroadcastTransport<unknown> | undefined

  constructor(config: IServerConfig = {}) {
    // Default config values
    const defaultConfig: Required<IServerConfig> = {
      broadcastChunkSize: 500,
      transport: undefined as any,
      registry: new ClientRegistry(),
      middleware: [],
      server: undefined as any,
      port: 3000,
      host: '0.0.0.0',
      path: '/synnel',
      enablePing: true,
      pingInterval: 5000,
      pingTimeout: 5000,
      connections: undefined as any,
    }

    this.config = { ...defaultConfig, ...config }

    // Create or use injected client registry
    this.registry = this.config.registry

    // Create middleware manager
    this.middleware = new MiddlewareManager()

    // Register any middleware from config
    if (this.config.middleware) {
      for (const mw of this.config.middleware) {
        this.middleware.use(mw)
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

    // Create handlers with getChannel callback
    this.connectionHandler = new ConnectionHandler({
      registry: this.registry,
    })

    this.messageHandler = new MessageHandler({
      registry: this.registry,
      middleware: this.middleware,
    })

    this.signalHandler = new SignalHandler({
      registry: this.registry,
      middleware: this.middleware,
    })

    // Set up transport event handlers
    this.setupTransportHandlers()

    // Create broadcast channel and register it
    this.broadcastChannel = new BroadcastChannel(
      this.registry,
      this.config.broadcastChunkSize,
    )
    this.registry.registerChannel(this.broadcastChannel)

    // Update state
    this.status.started = true
    this.status.startedAt = Date.now()
  }

  async stop(): Promise<void> {
    if (!this.status.started || !this.transport) {
      return // Already stopped
    }

    // Stop transport (closes all connections)
    this.transport.stop?.()

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

  createBroadcast<T = unknown>(): IBroadcastTransport<T> {
    if (!this.status.started || !this.broadcastChannel) {
      throw new StateError('Server must be started before creating channels')
    }
    return this.broadcastChannel as IBroadcastTransport<T>
  }

  createMulticast<T = unknown>(name: ChannelName): IMulticastTransport<T> {
    if (!this.status.started || !this.transport) {
      throw new StateError('Server must be started before creating channels')
    }

    // Check if channel already exists
    const existing = this.registry.getChannel<T>(name) as
      | IMulticastTransport<T>
      | undefined
    if (existing) {
      return existing
    }

    // Create ChannelRef with BaseChannel inheritance
    const channel = new ChannelRef<T>(
      name,
      this.registry,
      // Closure to get subscriber IDs for this channel
      () => new Set(this.registry.getSubscribers(name).map((c) => c.id)),
      // Handler registry
      (this.registry as any).handlers,
      // Closure to subscribe a client
      (clientId) => this.registry.subscribe(clientId, name),
      // Closure to unsubscribe a client
      (clientId) => this.registry.unsubscribe(clientId, name),
      // Chunk size for publishing
      this.config.broadcastChunkSize,
    )

    // Register instance in registry
    this.registry.registerChannel(channel as any)

    return channel
  }

  hasChannel(name: ChannelName): boolean {
    return !!this.registry.getChannel(name)
  }

  getChannels(): ChannelName[] {
    return this.registry.getChannels()
  }

  // ============================================================
  // MIDDLEWARE METHODS
  // ============================================================

  use(middleware: IMiddleware): void {
    this.middleware.use(middleware)
  }

  // ============================================================
  // STATS AND UTILITIES
  // ============================================================

  getStats(): IServerStats {
    return {
      startedAt: this.status.startedAt,
      clientCount: this.registry.getCount(),
      channelCount: this.registry.getChannels().length,
      subscriptionCount: this.registry.getTotalSubscriptionCount(),
    }
  }

  getConfig(): Readonly<IServerConfig> {
    return this.config
  }

  getRegistry(): IClientRegistry {
    return this.registry
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private setupTransportHandlers(): void {
    const transport = this.transport!

    // Handle new connections
    transport.on('connection', async (connection) => {
      try {
        await this.middleware.executeConnection(connection, 'connect')
        await this.connectionHandler!.handleConnection(connection)
      } catch (error) {
        console.error('Error handling connection:', error)
      }
    })

    // Handle disconnections
    transport.on('disconnection', async (clientId) => {
      try {
        const client = this.registry.get(clientId)
        if (client) {
          await this.middleware.executeConnection(client, 'disconnect')
          await this.connectionHandler!.handleDisconnection(clientId)
        }
      } catch (error) {
        console.error('Error handling disconnection:', error)
      }
    })

    // Handle messages
    transport.on('message', async (clientId: string, message: Message) => {
      try {
        const client = this.registry.get(clientId)
        if (!client) return

        if (message.type === 'data') {
          await this.messageHandler!.handleMessage(
            client,
            message as DataMessage<unknown>,
          )
        } else if (message.type === 'signal') {
          await this.signalHandler!.handleSignal(
            client,
            message as SignalMessage,
          )
        }
      } catch (error) {
        console.error('Error handling message:', error)
      }
    })

    // Handle transport errors
    transport.on('error', (error: Error) => {
      console.error('Transport error:', error)
    })
  }
}
