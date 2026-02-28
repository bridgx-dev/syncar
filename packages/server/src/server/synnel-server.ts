/**
 * Synnel Server
 * Main server class for real-time WebSocket communication.
 *
 * @remarks
 * This class provides the core server functionality including:
 * - Client connection lifecycle management
 * - Channel-based messaging (broadcast and multicast)
 * - Event-driven architecture with emitter
 * - Middleware support for authentication, logging, rate limiting
 * - Authorization hooks for channel access control
 *
 * @example
 * ```typescript
 * import { createSynnelServer } from '@synnel/server'
 *
 * const server = createSynnelServer({ port: 3000 })
 * await server.start()
 *
 * // Create channels
 * const broadcast = server.createBroadcast<string>()
 * const chat = server.createMulticast<{ text: string }>('chat')
 *
 * // Handle events
 * server.on('connection', (client) => {
 *   console.log(`Client connected: ${client.id}`)
 * })
 * ```
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
 * @internal
 */
interface ServerState {
  started: boolean
  startedAt: number | undefined
}

/**
 * Synnel Server - Main server class for real-time WebSocket communication
 *
 * @remarks
 * The server manages client connections, channels, and message routing.
 * It provides a comprehensive API for building real-time applications.
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
   *
   * @param config - Server configuration options
   * @param config.transport - Optional transport layer (required if not using factory)
   * @param config.registry - Optional custom client registry
   * @param config.middleware - Optional middleware functions to register
   * @param config.broadcastChunkSize - Chunk size for broadcast operations (default: 500)
   *
   * @example
   * ```typescript
   * const server = new SynnelServer({
   *   transport: new WebSocketServerTransport({ server: httpServer }),
   *   broadcastChunkSize: 1000
   * })
   * await server.start()
   * ```
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
   *
   * Initializes the transport layer, creates handlers, and sets up the broadcast channel.
   * The server must be started before creating channels or handling connections.
   *
   * @throws {StateError} If server is already started
   * @throws {ConfigError} If transport is not configured
   *
   * @example
   * ```typescript
   * await server.start()
   * console.log('Server started')
   * ```
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
   *
   * Gracefully shuts down the transport, closes all connections,
   * and clears all channels and handlers.
   *
   * @remarks
   * This method is idempotent - calling it multiple times has no additional effect.
   * All client connections will be closed, and the registry will be cleared.
   *
   * @example
   * ```typescript
   * await server.stop()
   * console.log('Server stopped')
   * ```
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
   *
   * Broadcast channels send messages to all connected clients.
   * No subscription is required - all clients receive broadcast messages.
   *
   * @template T - Type of data to be published
   * @returns Broadcast transport for publishing to all clients
   * @throws {StateError} If server is not started
   *
   * @example
   * ```typescript
   * const broadcast = server.createBroadcast<string>()
   *
   * // Send to all clients
   * broadcast.publish('Hello everyone!')
   *
   * // Send excluding specific clients
   * broadcast.publish('Private message', { exclude: ['client-123'] })
   *
   * // Send to specific clients only
   * broadcast.publish('Secret', { to: ['client-1', 'client-2'] })
   * ```
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
   * Multicast channels send messages only to subscribed clients.
   * Clients must explicitly subscribe to receive messages.
   *
   * @template T - Type of data to be published
   * @param name - Unique channel name
   * @returns Multicast transport for the channel
   * @throws {StateError} If server is not started
   *
   * @remarks
   * If a channel with the given name already exists, it will be returned
   * instead of creating a new one. Use {@link hasChannel} to check existence first.
   *
   * Channel options like maxSubscribers, reserved, and historySize
   * are no longer supported. Use onSubscribe callbacks to implement
   * custom logic like max subscribers or reserved channel checks.
   *
   * @example
   * ```typescript
   * const chat = server.createMulticast<{ text: string }>('chat')
   *
   * // Handle incoming messages
   * chat.receive((data, client) => {
   *   console.log(`${client.id}: ${data.text}`)
   *   chat.publish(data) // Echo to all subscribers
   * })
   *
   * // Listen for subscriptions
   * chat.onSubscribe((client) => {
   *   chat.publish({ text: `Welcome ${client.id}!` })
   * })
   *
   * // Publish to subscribers
   * chat.publish({ text: 'Hello chat!' })
   * ```
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
   *
   * @param name - Channel name to check
   * @returns true if the channel exists, false otherwise
   *
   * @example
   * ```typescript
   * if (!server.hasChannel('chat')) {
   *   server.createMulticast('chat')
   * }
   * ```
   */
  hasChannel(name: ChannelName): boolean {
    return !!this.registry.getChannel(name)
  }


  /**
   * Get all active channel names
   *
   * @returns Array of channel names that have been created
   *
   * @example
   * ```typescript
   * const channels = server.getChannels()
   * console.log('Active channels:', channels) // ['chat', 'notifications']
   * ```
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

  /**
   * Register an event handler
   *
   * @template E - Event type
   * @param event - Event name to listen for
   * @param handler - Event handler function
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = server.on('connection', (client) => {
   *   console.log(`Client connected: ${client.id}`)
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  on<E extends IServerEventType>(
    event: E,
    handler: IServerEventMap[E],
  ): () => void {
    return this.emitter.on(event, handler as any)
  }

  /**
   * Register a one-time event handler
   *
   * The handler will be automatically removed after being called once.
   *
   * @template E - Event type
   * @param event - Event name to listen for
   * @param handler - Event handler function
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * server.once('connection', (client) => {
   *   console.log('First client connected!')
   * })
   * ```
   */
  once<E extends IServerEventType>(
    event: E,
    handler: IServerEventMap[E],
  ): () => void {
    return this.emitter.once(event, handler as any)
  }

  /**
   * Emit an event locally
   *
   * Emits an event on the server without sending to clients.
   *
   * @template E - Event type
   * @param event - Event name to emit
   * @param args - Event arguments
   *
   * @example
   * ```typescript
   * server.emit('customEvent', { data: 'value' })
   * ```
   */
  emit<E extends IServerEventType>(
    event: E,
    ...args: IServerEventMap[E] extends (...args: infer P) => any ? P : never
  ): void {
    this.emitter.emit(event, ...(args as any))
  }

  /**
   * Remove an event handler
   *
   * @template E - Event type
   * @param event - Event name
   * @param handler - Handler function to remove
   *
   * @example
   * ```typescript
   * const handler = (client) => console.log('Connected')
   * server.on('connection', handler)
   * server.off('connection', handler)
   * ```
   */
  off<E extends IServerEventType>(event: E, handler: IServerEventMap[E]): void {
    this.emitter.off(event, handler as any)
  }

  // ============================================================
  // MIDDLEWARE METHODS
  // ============================================================

  /**
   * Register a middleware function
   *
   * Middleware functions are executed in order for each action
   * (connect, disconnect, message, subscribe, unsubscribe).
   *
   * @param middleware - Middleware function to register
   *
   * @example
   * ```typescript
   * server.use(async ({ client, action }) => {
   *   console.log(`[${action}] ${client.id}`)
   * })
   * ```
   */
  use(middleware: any): void {
    this.middleware.use(middleware)
  }

  // ============================================================
  // HANDLER METHODS
  // ============================================================

  /**
   * Register a global message handler
   *
   * The handler is called for every message received from any client.
   *
   * @param handler - Message handler function
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = server.onMessage((client, message) => {
   *   console.log(`From ${client.id}:`, message)
   * })
   * ```
   */
  onMessage(
    handler: (client: IClientConnection, message: Message) => void,
  ): () => void {
    this.globalMessageHandlers.add(handler)
    return () => this.globalMessageHandlers.delete(handler)
  }

  /**
   * Register an authorization handler
   *
   * The handler is called before actions to check permissions.
   * Return false to reject the action.
   *
   * @param handler - Authorization function
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * server.authorize(async (clientId, channel, action) => {
   *   if (channel === 'admin') {
   *     return await isAdmin(clientId)
   *   }
   *   return true
   * })
   * ```
   */
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

  /**
   * Get server statistics
   *
   * @returns Server stats including client count, channel count, and subscription count
   *
   * @example
   * ```typescript
   * const stats = server.getStats()
   * console.log(`Clients: ${stats.clientCount}`)
   * console.log(`Channels: ${stats.channelCount}`)
   * console.log(`Subscriptions: ${stats.subscriptionCount}`)
   * ```
   */
  getStats(): IServerStats {
    return {
      startedAt: this.state.startedAt,
      clientCount: this.registry.getCount(),
      channelCount: this.registry.getChannels().length,
      subscriptionCount: this.registry.getTotalSubscriptionCount(),
    }
  }

  /**
   * Get the server configuration (read-only)
   *
   * @returns Readonly server configuration
   */
  getConfig(): Readonly<IServerConfig> {
    return this.config
  }

  /**
   * Get the client registry
   *
   * @returns The client registry instance
   *
   * @remarks
   * This provides direct access to the registry for advanced use cases
   * like managing clients or channels directly.
   */
  getRegistry(): IClientRegistry {
    return this.registry
  }

  /**
   * Get the event emitter
   *
   * @returns The event emitter instance
   *
   * @remarks
   * This provides direct access to the emitter for advanced use cases
   * like emitting custom events or managing listeners.
   */
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
