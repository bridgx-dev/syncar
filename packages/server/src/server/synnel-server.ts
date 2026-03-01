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
  private readonly config: Required<IServerConfig>
  private transport: IServerTransport | undefined
  public readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly status: ServerState = { started: false, startedAt: undefined }
  private connectionHandler: ConnectionHandler | undefined
  private messageHandler: MessageHandler | undefined
  private signalHandler: SignalHandler | undefined

  private broadcastChannel: IBroadcastTransport<unknown> | undefined


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
    if (!this.status.started || !this.broadcastChannel) {
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
    if (!this.status.started || !this.transport) {
      throw new StateError('Server must be started before creating channels')
    }

    // Check if channel already exists
    const existing = this.registry.getChannel<T>(name) as IMulticastTransport<T> | undefined
    if (existing) {
      return existing
    }

    // Create ChannelRef with BaseChannel inheritance
    const channel = new ChannelRef<T>(
      name,
      this.registry,
      // Closure to get subscriber IDs for this channel
      () => new Set(this.registry.getSubscribers(name).map(c => c.id)),
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
  use(middleware: IMiddleware): void {
    this.middleware.use(middleware)
  }

  // ============================================================
  // HANDLER METHODS
  // ============================================================



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
      startedAt: this.status.startedAt,
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
          await this.messageHandler!.handleMessage(client, message as DataMessage<unknown>)
        } else if (message.type === 'signal') {
          await this.signalHandler!.handleSignal(client, message as SignalMessage)
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
