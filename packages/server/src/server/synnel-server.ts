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
  IClientConnection,
  IMiddlewareManager,
  IEventEmitter,
  IServerEventMap,
  IServerEventType,
  IBroadcastTransport,
  IMulticastTransport,
  ChannelName,
  ClientId,
  Message,
  IPublishOptions,
} from '../types'
import { ClientRegistry } from '../registry'
import { ChannelRef } from '../channel/channel-ref'
import { BroadcastChannel } from '../channel'
import { MiddlewareManager } from '../middleware'
import { EventEmitter } from '../emitter'
import { ConnectionHandler } from '../handlers'
import { MessageHandler } from '../handlers'
import { SignalHandler } from '../handlers'
import { StateError, ConfigError } from '../errors'
import { createDataMessage } from '../lib'

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
  public readonly registry: ClientRegistry // Changed to public for ChannelRef access
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private connectionHandler: ConnectionHandler | undefined
  private messageHandler: MessageHandler | undefined
  private signalHandler: SignalHandler | undefined

  private broadcastChannel: IBroadcastTransport<unknown> | undefined
  private readonly globalMessageHandlers: Set<
    (client: IClientConnection, message: Message) => void
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
    this.registry = (config.registry as ClientRegistry) ?? new ClientRegistry()

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

    // Set default broadcast chunk size
    if (this.config.broadcastChunkSize === undefined) {
      this.config.broadcastChunkSize = 500
    }
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

    // Create handlers with getChannel callback
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
    this.broadcastChannel = new BroadcastChannel(
      this.transport.connections,
      this.config.broadcastChunkSize,
    )
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
   * Create or get a multicast transport using ChannelRef
   *
   * Note: Channel options like maxSubscribers, reserved, and historySize
   * are no longer supported. Use onSubscribe callbacks to implement
   * custom logic like max subscribers or reserved channel checks.
   */
  createMulticast<T = unknown>(
    name: ChannelName,
  ): IMulticastTransport<T> {
    if (!this.state.started || !this.transport) {
      throw new StateError('Server must be started before creating channels')
    }

    // Check if channel already exists
    const existing = this.registry.getChannel<T>(name) as IMulticastTransport<T> | undefined
    if (existing) {
      return existing
    }


    // Create ChannelRef with closures to registry state
    const channel = new ChannelRef<T>(
      name,
      // Closure to get subscribers for this channel
      () => this.registry.getChannelSubscribers(name),
      // Handler registry
      this.registry.handlers,
      // Closure to subscribe a client
      (clientId) => this.registry.subscribe(clientId, name),
      // Closure to unsubscribe a client
      (clientId) => this.registry.unsubscribe(clientId, name),
      // Closure to publish to this channel
      (data, options) => this.publishToChannel(name, data, options),
    )

    // Register instance in registry
    this.registry.registerChannel(channel as any)

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

  /**
   * Publish data to a specific channel
   *
   * @param channelName - Channel to publish to
   * @param data - Data to publish
   * @param options - Optional publish options (to, exclude)
   */
  private publishToChannel<T>(
    channelName: ChannelName,
    data: T,
    options?: IPublishOptions,
  ): void {
    const subscribers = this.registry.getChannelSubscribers(channelName)
    const chunkSize = this.config.broadcastChunkSize || 500

    if (subscribers.size > chunkSize) {
      // Use chunked publishing for large subscriber sets to avoid blocking event loop
      this.publishInChunks(channelName, data, subscribers, options)
    } else {
      // Synchronous publish for small sets
      this.publishToSubscribers(channelName, data, subscribers, options)
    }
  }

  /**
   * Internal helper to publish to a set of subscribers synchronously
   */
  private publishToSubscribers<T>(
    channelName: ChannelName,
    data: T,
    subscribers: Set<ClientId> | ClientId[],
    options?: IPublishOptions,
  ): void {
    // Create data message
    const message = createDataMessage<T>(channelName, data)

    // Publish to each subscriber
    for (const clientId of subscribers) {
      // Apply filters
      if (options?.to && !options.to.includes(clientId)) continue
      if (options?.exclude && options.exclude.includes(clientId)) continue

      // Get client connection
      const client = this.registry.connections.get(clientId)
      if (client) {
        try {
          client.socket.send(JSON.stringify(message))
        } catch (error) {
          console.error(`Failed to send to ${clientId}:`, error)
        }
      }
    }
  }

  /**
   * Publish data to a channel in chunks using setImmediate to avoid blocking the event loop
   */
  private publishInChunks<T>(
    channelName: ChannelName,
    data: T,
    subscribers: Set<ClientId>,
    options?: IPublishOptions,
  ): void {
    const subscriberIds = Array.from(subscribers)
    const chunkSize = this.config.broadcastChunkSize || 500
    let index = 0

    const nextChunk = () => {
      const chunk = subscriberIds.slice(index, index + chunkSize)
      if (chunk.length === 0) return

      this.publishToSubscribers(channelName, data, chunk, options)
      index += chunkSize

      if (index < subscriberIds.length) {
        setImmediate(nextChunk)
      }
    }

    nextChunk()
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
    handler: (client: IClientConnection, message: Message) => void,
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

        // ROUTE TO APPROPRIATE HANDLER
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
