/**
 * Synnel Server
 * Main server class for real-time WebSocket communication.
 *
 * @module server/synnel-server
 */

import type {
  IServerConfig,
  ISynnelServer,
  IServerStats,
} from '../types/server.js'
import type { IServerTransport } from '../types/transport.js'
import type { IClientRegistry, IServerClient } from '../types/client.js'
import type { IMiddlewareManager } from '../types/middleware.js'
import type { IEventEmitter } from '../types/events.js'
import type { IServerEventMap, IServerEventType } from '../types/events.js'
import type {
  IBroadcastTransport,
  IMulticastTransport,
  IChannelOptions,
} from '../types/channel.js'
import type { ChannelName, Message } from '@synnel/types'
import { ClientRegistry } from '../registry/index.js'
import { MiddlewareManager } from '../middleware/index.js'
import { EventEmitter } from '../emitter/index.js'
import { BroadcastTransport } from '../channel/broadcast-transport.js'
import { MulticastTransport } from '../channel/index.js'
import { ConnectionHandler } from '../handlers/connection-handler.js'
import { MessageHandler } from '../handlers/message-handler.js'
import { SignalHandler } from '../handlers/signal-handler.js'
import {
  DEFAULT_MAX_SUBSCRIBERS,
  DEFAULT_HISTORY_SIZE,
} from '../config/constants.js'
import { BROADCAST_CHANNEL } from '../config/constants.js'
import { StateError, ConfigError } from '../errors/index.js'

// ============================================================
// CHANNEL MAP TYPE
// ============================================================

/**
 * Internal channel map type
 * Maps channel names to channel instances (both broadcast and multicast)
 */
type ChannelMap = Map<
  ChannelName,
  IBroadcastTransport<unknown> | IMulticastTransport<unknown>
>

// ============================================================
// SERVER INTERNAL STATE
// ============================================================

/**
 * Internal server state
 */
interface ServerState {
  started: boolean
  startedAt: number | undefined
}

// ============================================================
// SYNEL SERVER CLASS
// ============================================================

/**
 * Synnel Server - Main server class for real-time WebSocket communication
 *
 * The server manages:
 * - WebSocket transport for client connections
 * - Client registry for connection tracking
 * - Middleware system for request processing
 * - Event system for server events
 * - Handlers for connections, messages, and signals
 * - Broadcast and multicast channels
 *
 * @example
 * ```ts
 * import { SynnelServer } from '@synnel/server'
 *
 * const server = new SynnelServer({
 *   port: 3000,
 *   path: '/ws'
 * })
 *
 * // Start the server
 * await server.start()
 *
 * // Create channels
 * const broadcast = server.createBroadcast<string>()
 * const chat = server.createMulticast<string>('chat')
 *
 * // Listen for events
 * server.on('connection', (client) => {
 *   console.log(`Client connected: ${client.id}`)
 * })
 *
 * // Stop the server
 * await server.stop()
 * ```
 */
export class SynnelServer implements ISynnelServer {
  /**
   * Server configuration
   */
  private readonly config: IServerConfig

  /**
   * WebSocket transport layer
   */
  private transport: IServerTransport | undefined

  /**
   * Client registry
   */
  private readonly registry: IClientRegistry

  /**
   * Middleware manager
   */
  private readonly middleware: IMiddlewareManager

  /**
   * Event emitter
   */
  private readonly emitter: IEventEmitter<IServerEventMap>

  /**
   * Connection handler
   */
  private connectionHandler: ConnectionHandler | undefined

  /**
   * Message handler
   */
  private messageHandler: MessageHandler | undefined

  /**
   * Signal handler
   */
  private signalHandler: SignalHandler | undefined

  /**
   * Active channels (broadcast + multicast)
   */
  private readonly channels: ChannelMap

  /**
   * Broadcast channel reference (cached for quick access)
   */
  private broadcastChannel: IBroadcastTransport<unknown> | undefined

  /**
   * Global message handlers
   */
  private readonly globalMessageHandlers: Set<
    (client: IServerClient, message: Message) => void
  >

  /**
   * Authorization handler
   */
  private authorizationHandler:
    | ((
        clientId: string,
        channel: string,
        action: string,
      ) => boolean | Promise<boolean>)
    | undefined

  /**
   * Internal server state
   */
  private readonly state: ServerState

  /**
   * Create a new SynnelServer instance
   *
   * @param config - Server configuration options
   *
   * @example
   * ```ts
   * // With default options
   * const server = new SynnelServer()
   *
   * // With custom port
   * const server = new SynnelServer({ port: 8080 })
   *
   * // With existing HTTP server
   * const server = new SynnelServer({ server: httpServer })
   *
   * // With custom path
   * const server = new SynnelServer({ path: '/websocket' })
   *
   * // With middleware
   * const server = new SynnelServer({
   *   port: 3000,
   *   middleware: [authMiddleware, loggingMiddleware]
   * })
   * ```
   */
  constructor(config: IServerConfig = {}) {
    this.config = config
    this.channels = new Map()
    this.globalMessageHandlers = new Set()
    this.state = { started: false, startedAt: undefined }

    // Create client registry
    this.registry = new ClientRegistry()

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

  // ============================================================
  // LIFECYCLE METHODS
  // ============================================================

  /**
   * Start the server
   *
   * Creates handlers and sets up event listeners.
   * If no transport was provided in config, one must be set before calling start.
   *
   * @throws StateError if server is already started
   * @throws ConfigError if transport is not available
   *
   * @example
   * ```ts
   * try {
   *   await server.start()
   *   console.log('Server started')
   * } catch (error) {
   *   console.error('Failed to start:', error)
   * }
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

    // Create handlers
    this.connectionHandler = new ConnectionHandler({
      registry: this.registry,
      middleware: this.middleware,
      emitter: this.emitter,
      transport: this.transport,
    })

    this.messageHandler = new MessageHandler({
      registry: this.registry,
      middleware: this.middleware,
      emitter: this.emitter,
      channels: this.channels,
    })

    this.signalHandler = new SignalHandler({
      registry: this.registry,
      middleware: this.middleware,
      emitter: this.emitter,
      channels: this.channels as Map<ChannelName, IMulticastTransport<unknown>>,
      sendToClient: this.transport.sendToClient.bind(this.transport),
    })

    // Set up transport event handlers
    this.setupTransportHandlers()

    // Create broadcast channel
    this.broadcastChannel = new BroadcastTransport(this.transport.connections)
    this.channels.set(BROADCAST_CHANNEL, this.broadcastChannel)

    // Update state
    this.state.started = true
    this.state.startedAt = Date.now()
  }

  /**
   * Stop the server
   *
   * Closes all connections and stops listening.
   *
   * @example
   * ```ts
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

    // Clear channels
    this.channels.clear()
    this.broadcastChannel = undefined

    // Update state
    this.state.started = false
    this.state.startedAt = undefined
  }

  // ============================================================
  // CHANNEL METHODS
  // ============================================================

  /**
   * Create a broadcast transport for server-to-all communication
   *
   * @template T The type of data to broadcast
   * @returns Broadcast transport instance
   *
   * @example
   * ```ts
   * const broadcast = server.createBroadcast<string>()
   * broadcast.publish('Hello everyone!')
   * ```
   */
  createBroadcast<T = unknown>(): IBroadcastTransport<T> {
    if (!this.state.started) {
      throw new StateError('Server must be started before creating channels')
    }

    return this.broadcastChannel as IBroadcastTransport<T>
  }

  /**
   * Create or get a multicast transport for topic-based messaging
   *
   * @template T The type of data for this channel
   * @param name - Channel name
   * @param options - Channel options
   * @returns Multicast transport instance
   *
   * @example
   * ```ts
   * const chat = server.createMulticast<string>('chat', {
   *   maxSubscribers: 100,
   *   historySize: 50
   * })
   *
   * chat.receive((data, client) => {
   *   console.log(`${client.id}: ${data}`)
   * })
   * ```
   */
  createMulticast<T = unknown>(
    name: ChannelName,
    options?: IChannelOptions,
  ): IMulticastTransport<T> {
    if (!this.state.started || !this.transport) {
      throw new StateError('Server must be started before creating channels')
    }

    // Check if channel already exists
    const existing = this.channels.get(name)
    if (existing) {
      return existing as IMulticastTransport<T>
    }

    // Create new multicast channel
    const channel = new MulticastTransport<T>(
      name,
      this.transport.connections,
      {
        maxSubscribers: options?.maxSubscribers ?? DEFAULT_MAX_SUBSCRIBERS,
        reserved: options?.reserved ?? false,
        historySize: options?.historySize ?? DEFAULT_HISTORY_SIZE,
      },
    )

    // Store channel
    this.channels.set(name, channel)

    return channel
  }

  /**
   * Check if a channel exists
   *
   * @param name - Channel name to check
   * @returns true if channel exists, false otherwise
   *
   * @example
   * ```ts
   * if (server.hasChannel('chat')) {
   *   console.log('Chat channel exists')
   * }
   * ```
   */
  hasChannel(name: ChannelName): boolean {
    return this.channels.has(name)
  }

  /**
   * Get all active channel names
   *
   * @returns Array of channel names
   *
   * @example
   * ```ts
   * const channels = server.getChannels()
   * console.log('Active channels:', channels)
   * ```
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channels.keys())
  }

  // ============================================================
  // EVENT METHODS
  // ============================================================

  /**
   * Register an event handler
   *
   * @template E The event type
   * @param event - The event to listen for
   * @param handler - The event handler
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = server.on('connection', (client) => {
   *   console.log(`Client connected: ${client.id}`)
   * })
   *
   * // Later: unsubscribe()
   * unsubscribe()
   * ```
   */
  on<E extends IServerEventType>(
    event: E,
    handler: IServerEventMap[E],
  ): () => void {
    return this.emitter.on(event, handler)
  }

  /**
   * Register a global message handler
   *
   * Called for every message received from any client.
   *
   * @param handler - Message handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = server.onMessage((client, message) => {
   *   console.log(`Client ${client.id} sent:`, message)
   * })
   * ```
   */
  onMessage(
    handler: (client: IServerClient, message: Message) => void,
  ): () => void {
    this.globalMessageHandlers.add(handler)

    // Return unsubscribe function
    return () => {
      this.globalMessageHandlers.delete(handler)
    }
  }

  /**
   * Set authorization handler for connection/subscription/message actions
   *
   * @param handler - Authorization handler (return false to reject, true to allow)
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
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

    // Return unsubscribe function
    return () => {
      this.authorizationHandler = undefined
    }
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Get server statistics
   *
   * @returns Server statistics
   *
   * @example
   * ```ts
   * const stats = server.getStats()
   * console.log(`Connected clients: ${stats.clientCount}`)
   * console.log(`Active channels: ${stats.channelCount}`)
   * ```
   */
  getStats(): IServerStats {
    return {
      clientCount: this.registry.getCount(),
      channelCount: this.channels.size,
      subscriptionCount: this.registry.getTotalSubscriptionCount(),
      messagesReceived: 0, // TODO: Track received messages
      messagesSent: 0, // TODO: Track sent messages
      startedAt: this.state.startedAt,
    }
  }

  /**
   * Register a middleware function
   *
   * @param middleware - The middleware to register
   *
   * @example
   * ```ts
   * server.use(async ({ client, action }) => {
   *   console.log(`[${action}] Client: ${client.id}`)
   * })
   * ```
   */
  use(middleware: unknown): void {
    this.middleware.use(middleware as Parameters<IMiddlewareManager['use']>[0])
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Set up transport event handlers
   * Routes transport events to appropriate handlers
   */
  private setupTransportHandlers(): void {
    if (
      !this.transport ||
      !this.connectionHandler ||
      !this.messageHandler ||
      !this.signalHandler
    ) {
      return
    }

    const transport = this.transport

    // Handle new connections
    transport.on('connection', async (connection) => {
      try {
        await this.connectionHandler!.handleConnection(connection)
      } catch (error) {
        // Connection rejected or failed - emit error event
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
    // Transport emits (clientId: ClientId, message: Message)
    // We need to look up IServerClient from registry
    transport.on('message', async (clientId, message) => {
      try {
        // Look up the client from registry
        const client = this.registry.get(clientId as string)
        if (!client) {
          // Client not found in registry - skip message
          return
        }

        // Check authorization first
        if (this.authorizationHandler) {
          const authorized = await this.authorizationHandler(
            client.id,
            message.channel ?? '',
            'message',
          )
          if (!authorized) {
            return // Reject message
          }
        }

        // Call global message handlers
        for (const handler of this.globalMessageHandlers) {
          try {
            handler(client, message)
          } catch {
            // Ignore handler errors
          }
        }

        // Route to appropriate handler based on message type
        if (message.type === ('data' as const)) {
          await this.messageHandler!.handleMessage(client, message)
        } else if (message.type === ('signal' as const)) {
          await this.signalHandler!.handleSignal(client, message)
        }
      } catch (error) {
        // Message processing error - emit error event
        this.emitter.emit('error', error as Error)
      }
    })

    // Handle transport errors
    transport.on('error', (error) => {
      this.emitter.emit('error', error)
    })
  }
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IServerConfig,
  ISynnelServer,
  IServerStats,
} from '../types/server.js'

export type { IServerTransport } from '../types/transport.js'
export type { IClientRegistry } from '../types/client.js'
export type { IMiddlewareManager } from '../types/middleware.js'
export type { IEventEmitter } from '../types/events.js'
export type {
  IBroadcastTransport,
  IMulticastTransport,
  IChannelOptions,
} from '../types/channel.js'
export type { ChannelName, Message } from '@synnel/types'
