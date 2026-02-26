/**
 * Synnel Server
 * Main server class for real-time WebSocket communication.
 */

import type {
  IServerConfig,
  ISynnelServer,
  IServerStats,
  IServerTransport,
  IClientRegistry,
  IServerClient,
  IMiddlewareManager,
  IEventEmitter,
  IServerEventMap,
  IServerEventType,
  IBroadcastTransport,
  IMulticastTransport,
  IChannelOptions,
  ChannelName,
  Message,
} from '../types'
import { ClientRegistry } from '../registry'
import { MiddlewareManager } from '../middleware'
import { EventEmitter } from '../emitter'
import { BroadcastTransport } from '../channel'
import { MulticastTransport } from '../channel'
import { ConnectionHandler } from '../handlers'
import { MessageHandler } from '../handlers'
import { SignalHandler } from '../handlers'
import { DEFAULT_MAX_SUBSCRIBERS, DEFAULT_HISTORY_SIZE } from '../config'
import { StateError, ConfigError } from '../errors'

/**
 * Internal server state
 */
interface ServerState {
  started: boolean
  startedAt: number | undefined
}

/**
 * Synnel Server - Main server class for real-time WebSocket communication
 */
export class SynnelServer implements ISynnelServer {
  private readonly config: IServerConfig
  private transport: IServerTransport | undefined
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private connectionHandler: ConnectionHandler | undefined
  private messageHandler: MessageHandler | undefined
  private signalHandler: SignalHandler | undefined

  private broadcastChannel: IBroadcastTransport<unknown> | undefined
  private readonly globalMessageHandlers: Set<
    (client: IServerClient, message: Message) => void
  >

  private authorizationHandler:
    | ((
        clientId: string,
        channel: string,
        action: string,
      ) => boolean | Promise<boolean>)
    | undefined

  private readonly state: ServerState

  /**
   * Create a new SynnelServer instance
   */
  constructor(config: IServerConfig = {}) {
    this.config = config
    this.globalMessageHandlers = new Set()
    this.state = { started: false, startedAt: undefined }

    // Create or use injected client registry
    this.registry = config.registry ?? new ClientRegistry()

    // Create middleware manager
    this.middleware = new MiddlewareManager()

    // Register any middleware from config
    if (config.middleware) {
      for (const mw of config.middleware) {
        this.middleware.use(mw)
      }
    }

    // Create event emitter
    this.emitter = new EventEmitter<IServerEventMap>()
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.state.started) {
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
    this.connectionHandler = new ConnectionHandler({
      registry: this.registry,
      middleware: this.middleware,
      emitter: this.emitter,
    })

    this.messageHandler = new MessageHandler({
      registry: this.registry,
      middleware: this.middleware,
      emitter: this.emitter,
    })

    this.signalHandler = new SignalHandler({
      registry: this.registry,
      middleware: this.middleware,
      emitter: this.emitter,
    })

    // Set up transport event handlers
    this.setupTransportHandlers()

    // Create broadcast channel and register it
    this.broadcastChannel = new BroadcastTransport(this.transport.connections)
    this.registry.registerChannel(this.broadcastChannel)

    // Update state
    this.state.started = true
    this.state.startedAt = Date.now()
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.state.started || !this.transport) {
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
    this.state.started = false
    this.state.startedAt = undefined
  }

  // ============================================================
  // CHANNEL METHODS
  // ============================================================

  /**
   * Create a broadcast transport
   */
  createBroadcast<T = unknown>(): IBroadcastTransport<T> {
    if (!this.state.started || !this.broadcastChannel) {
      throw new StateError('Server must be started before creating channels')
    }

    return this.broadcastChannel as IBroadcastTransport<T>
  }

  /**
   * Create or get a multicast transport
   */
  createMulticast<T = unknown>(
    name: ChannelName,
    options?: IChannelOptions,
  ): IMulticastTransport<T> {
    if (!this.state.started || !this.transport) {
      throw new StateError('Server must be started before creating channels')
    }

    // Check if channel already exists
    const existing = this.registry.getChannel<T>(name)
    if (existing) {
      return existing as IMulticastTransport<T>
    }

    // Create new multicast channel using the shared connections map
    const channel = new MulticastTransport<T>(
      name,
      this.transport.connections,
      {
        maxSubscribers: options?.maxSubscribers ?? DEFAULT_MAX_SUBSCRIBERS,
        reserved: options?.reserved ?? false,
        historySize: options?.historySize ?? DEFAULT_HISTORY_SIZE,
      },
    )

    // Register channel in registry
    this.registry.registerChannel(channel)

    return channel
  }

  /**
   * Check if a channel exists
   */
  hasChannel(name: ChannelName): boolean {
    return !!this.registry.getChannel(name)
  }

  /**
   * Get all active channel names
   */
  getChannels(): ChannelName[] {
    return this.registry.getChannels()
  }

  // ============================================================
  // EVENT METHODS
  // ============================================================

  on<E extends IServerEventType>(
    event: E,
    handler: IServerEventMap[E],
  ): () => void {
    return this.emitter.on(event, handler as any)
  }

  once<E extends IServerEventType>(
    event: E,
    handler: IServerEventMap[E],
  ): () => void {
    return this.emitter.once(event, handler as any)
  }

  emit<E extends IServerEventType>(
    event: E,
    ...args: IServerEventMap[E] extends (...args: infer P) => any ? P : never
  ): void {
    this.emitter.emit(event, ...(args as any))
  }

  off<E extends IServerEventType>(event: E, handler: IServerEventMap[E]): void {
    this.emitter.off(event, handler as any)
  }

  // ============================================================
  // MIDDLEWARE METHODS
  // ============================================================

  use(middleware: any): void {
    this.middleware.use(middleware)
  }

  // ============================================================
  // HANDLER METHODS
  // ============================================================

  onMessage(
    handler: (client: IServerClient, message: Message) => void,
  ): () => void {
    this.globalMessageHandlers.add(handler)
    return () => this.globalMessageHandlers.delete(handler)
  }

  authorize(
    handler: (
      clientId: string,
      channel: string,
      action: string,
    ) => boolean | Promise<boolean>,
  ): () => void {
    this.authorizationHandler = handler
    return () => {
      if (this.authorizationHandler === handler) {
        this.authorizationHandler = undefined
      }
    }
  }

  // ============================================================
  // STATS AND UTILITIES
  // ============================================================

  getStats(): IServerStats {
    return {
      startedAt: this.state.startedAt,
      clientCount: this.registry.getCount(),
      channelCount: this.registry.getChannels().length,
      subscriptionCount: this.registry.getTotalSubscriptionCount(),
      messagesSent: 0,
      messagesReceived: 0,
    }
  }

  getConfig(): Readonly<IServerConfig> {
    return this.config
  }

  getRegistry(): IClientRegistry {
    return this.registry
  }

  getEmitter(): IEventEmitter<IServerEventMap> {
    return this.emitter
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private setupTransportHandlers(): void {
    const transport = this.transport!

    // Handle new connections
    transport.on('connection', async (connection) => {
      try {
        await this.connectionHandler!.handleConnection(connection)
      } catch (error) {
        // Connection error - emit error event
        this.emitter.emit('error', error as Error)
      }
    })

    // Handle disconnections
    transport.on('disconnection', async (clientId) => {
      try {
        await this.connectionHandler!.handleDisconnection(clientId)
      } catch (error) {
        // Disconnection error - emit error event
        this.emitter.emit('error', error as Error)
      }
    })

    // Handle messages
    transport.on('message', async (clientId, message) => {
      try {
        const client = this.registry.get(clientId as string)
        if (!client) return

        // Check authorization
        if (this.authorizationHandler) {
          const authorized = await this.authorizationHandler(
            client.id,
            message.channel ?? '',
            'message',
          )
          if (!authorized) return
        }

        // Call global message handlers
        for (const handler of this.globalMessageHandlers) {
          try {
            handler(client, message)
          } catch {
            // Ignore handler errors
          }
        }

        // Route to appropriate handler
        if (message.type === 'data') {
          await this.messageHandler!.handleMessage(client, message as any)
        } else if (message.type === 'signal') {
          await this.signalHandler!.handleSignal(client, message as any)
        }
      } catch (error) {
        this.emitter.emit('error', error as Error)
      }
    })

    // Handle transport errors
    transport.on('error', (error) => {
      this.emitter.emit('error', error)
    })
  }
}
