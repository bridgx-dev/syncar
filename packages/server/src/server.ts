/**
 * Synnel Server
 * Main server class for real-time WebSocket communication
 */

import type {
  ServerConfig,
  ServerStats,
  ServerClient,
  ServerEventType,
  ServerEventMap,
  MiddlewareContext,
  ServerTransport,
} from './types.js'
import type {
  Message,
  DataMessage,
  ChannelName,
  SignalType,
} from '@synnel/types'
import { MessageType, SignalType as CoreSignalType } from '@synnel/types'
import { WebSocketServerTransport } from './base.js'
import { ClientRegistry } from './client-registry.js'
import { MiddlewareManager, MiddlewareRejectionError } from './middleware.js'
import { BroadcastTransport, MulticastTransport } from './channel.js'
import { createServer } from 'http'

/**
 * Synnel Server
 * Main server class that orchestrates all components
 */
export class SynnelServer {
  private transport: ServerTransport
  private httpServer?: ReturnType<typeof createServer>
  private ownHttpServer: boolean = false
  private config: ServerConfig
  private registry: ClientRegistry = new ClientRegistry()
  private middleware: MiddlewareManager = new MiddlewareManager()
  private broadcastHandlers: Set<
    (
      data: unknown,
      client: ServerClient,
      message: DataMessage<unknown>,
    ) => void | Promise<void>
  > = new Set()
  private eventHandlers: Map<ServerEventType, Set<any>> = new Map()
  private started = false
  private messagesReceived = 0
  private messagesSent = 0
  private startedAt?: number
  private broadcast: BroadcastTransport
  private multicasts: Map<ChannelName, MulticastTransport> = new Map()

  constructor(config: ServerConfig = {}) {
    this.config = config

    // Determine transport source
    if (config.transport) {
      this.transport = config.transport
    } else {
      // If no server is provided, we create one ourselves
      if (!config.server) {
        this.httpServer = createServer()
        this.ownHttpServer = true
      }

      this.transport = new WebSocketServerTransport({
        server: config.server ?? this.httpServer,
        path: config.path ?? '/synnel',
        enablePing: config.enablePing ?? true,
        pingInterval: config.pingInterval ?? 5000,
        pingTimeout: config.pingTimeout,
      })
    }

    // Add provided middleware
    config.middleware?.forEach((mw) => this.middleware.use(mw))

    // Set up transport event handlers
    this.setupTransportHandlers()

    // Initialize broadcast transport
    this.broadcast = new BroadcastTransport(this.transport.connections)
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Server is already started')
    }

    // If we created the HTTP server, start listening on it
    if (this.ownHttpServer && this.httpServer) {
      const port = this.config.port ?? 3000
      const host = this.config.host ?? '0.0.0.0'

      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(port, host, () => {
          resolve()
        })
        this.httpServer!.on('error', reject)
      })
    }

    this.started = true
    this.startedAt = Date.now()
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return
    }

    this.started = false
    this.startedAt = undefined
    this.registry.clear()
    this.multicasts.clear()

    // Close HTTP server if we created it
    if (this.ownHttpServer && this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve())
      })
      this.httpServer = undefined
      this.ownHttpServer = false
    }
  }

  /**
   * Get the broadcast transport
   */
  broadcastTransport<T = unknown>(): BroadcastTransport<T> {
    return this.broadcast as BroadcastTransport<T>
  }

  /**
   * Create and return a new broadcast transport instance
   * This returns the shared broadcast transport
   */
  createBroadcast<T = unknown>(): BroadcastTransport<T> {
    return this.broadcast as BroadcastTransport<T>
  }

  /**
   * Create or get a multicast transport for the given channel
   * @param name - Channel name
   * @param options - Channel options (maxSubscribers, reserved, historySize)
   * @returns Multicast transport instance
   *
   * @example
   * ```ts
   * const chat = server.createMulticast('chat', { maxSubscribers: 100 })
   * chat.publish({ message: 'Hello everyone!' })
   * chat.receive((data, client) => {
   *   console.log(`Received from ${client.id}:`, data)
   * })
   * ```
   */
  createMulticast<T = unknown>(
    name: ChannelName,
    options?: import('@synnel/types').ChannelOptions,
  ): MulticastTransport<T> {
    // Check if already exists
    let multicast = this.multicasts.get(name)
    if (!multicast) {
      multicast = new MulticastTransport(
        name,
        this.transport.connections,
        options,
      )
      this.multicasts.set(name, multicast)
    }

    return multicast as MulticastTransport<T>
  }

  /**
   * Check if a channel exists
   */
  hasChannel(name: ChannelName): boolean {
    return this.multicasts.has(name)
  }

  /**
   * Get all active channels
   */
  getChannels(): ChannelName[] {
    return Array.from(this.multicasts.keys())
  }

  /**
   * Register an event handler
   */
  on<E extends ServerEventType>(
    event: E,
    handler: ServerEventMap[E],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)

    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.delete(handler)
      }
    }
  }

  /**
   * Get server statistics
   */
  getStats(): ServerStats {
    return {
      clientCount: this.registry.getCount(),
      channelCount: this.multicasts.size,
      subscriptionCount: this.registry.getTotalSubscriptionCount(),
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      startedAt: this.startedAt,
    }
  }

  /**
   * Use a middleware function
   */
  use(middleware: Parameters<MiddlewareManager['use']>[0]): void {
    this.middleware.use(middleware)
  }

  /**
   * Set authorization handler for connection/subscription/message actions
   * @param handler - Return false to reject, true to allow
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * synnel.authorize(async (clientId, channel, action) => {
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
    const middleware = async ({
      client,
      channel,
      action,
      reject,
    }: MiddlewareContext) => {
      const clientId = client?.id ?? 'unknown'
      const channelName = channel ?? ''
      const actionName = action

      try {
        const allowed = await handler(clientId, channelName, actionName)
        if (!allowed) {
          reject('Unauthorized')
        }
      } catch (error) {
        reject(`Authorization error: ${error}`)
      }
    }

    this.middleware.use(middleware)

    // Return unsubscribe function (middleware doesn't support removal, so this is a no-op)
    return () => {
      // Middleware cannot be removed after registration
    }
  }

  /**
   * Global message interceptor
   * Called for every message received from any client
   * @param handler - Message handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * synnel.onMessage((message, client) => {
   *   console.log(`Client ${client.id} sent:`, message)
   * })
   * ```
   */
  onMessage(
    handler: (client: ServerClient, message: Message) => void,
  ): () => void {
    return this.on('message', handler)
  }

  /**
   * Set up transport event handlers
   */
  private setupTransportHandlers(): void {
    // Handle new connections
    // Core transport emits connection object, adapter emits clientId
    this.transport.on('connection', async (connection: any) => {
      const clientId =
        typeof connection === 'string' ? connection : connection.id
      await this.handleConnection(
        clientId,
        typeof connection === 'string' ? undefined : connection,
      )
    })

    // Handle disconnections
    this.transport.on('disconnection', async (clientId: string) => {
      await this.handleDisconnection(clientId)
    })

    // Handle incoming messages
    this.transport.on('message', async (clientId: string, message: Message) => {
      await this.handleMessage(clientId, message)
    })

    // Handle errors
    this.transport.on('error', (error: Error) => {
      this.emit('error', error)
    })
  }

  /**
   * Handle a new client connection
   */
  private async handleConnection(
    clientId: string,
    connectionObject?: any,
  ): Promise<void> {
    const connection = connectionObject || this.transport.getClient(clientId)
    if (!connection) {
      return
    }

    // Register the client
    const serverClient = this.registry.register(
      clientId,
      this.transport,
      connection,
    )

    // Execute connection middleware
    try {
      await this.middleware.executeConnection(serverClient, 'connect')
    } catch (error) {
      if (error instanceof MiddlewareRejectionError) {
        // Reject connection
        await serverClient.disconnect(4001, error.reason)
        this.registry.unregister(clientId)
        return
      }
      throw error
    }

    // Emit connection event
    this.emit('connection', serverClient)
  }

  /**
   * Handle a client disconnection
   */
  private async handleDisconnection(clientId: string): Promise<void> {
    const serverClient = this.registry.get(clientId)
    if (!serverClient) {
      return
    }

    // Execute disconnect middleware
    try {
      await this.middleware.executeConnection(serverClient, 'disconnect')
    } catch {
      // Ignore middleware errors during disconnect
    }

    // Unsubscribe from all channels
    const subscriptions = serverClient.getSubscriptions()
    for (const channelName of subscriptions) {
      const multicast = this.multicasts.get(channelName)
      if (multicast) {
        // Call unsubscribe handlers
        await multicast.handleUnsubscribe(serverClient)
      }
    }

    // Unregister the client
    this.registry.unregister(clientId)

    // Emit disconnection event
    this.emit('disconnection', serverClient)
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(
    clientId: string,
    message: Message,
  ): Promise<void> {
    this.messagesReceived++

    const serverClient = this.registry.get(clientId)
    if (!serverClient) {
      return
    }

    // Execute message middleware
    try {
      await this.middleware.executeMessage(serverClient, message)
    } catch (error) {
      if (error instanceof MiddlewareRejectionError) {
        // Send error to client
        await serverClient.send({
          id: message.id,
          type: MessageType.ERROR,
          data: {
            message: error.reason,
            code: 'REJECTED',
          },
          timestamp: Date.now(),
        })
        return
      }
      throw error
    }

    // Handle signal messages
    if (message.type === MessageType.SIGNAL) {
      await this.handleSignal(
        serverClient,
        message.signal as SignalType,
        message.channel,
      )
      return
    }

    // Handle data messages
    if (message.type === MessageType.DATA) {
      const dataMessage = message as DataMessage
      const channel = dataMessage.channel

      if (!channel) {
        // Missing channel error
        await serverClient.send({
          id: message.id,
          type: MessageType.ERROR,
          data: {
            message: 'Channel is required for data messages',
            code: 'MISSING_CHANNEL',
          },
          timestamp: Date.now(),
        })
        return
      }

      // Handle broadcast messages
      if (channel === '__broadcast__') {
        for (const handler of this.broadcastHandlers) {
          try {
            await handler(dataMessage.data, serverClient, dataMessage as any)
          } catch (error) {
            console.error('Error in broadcast message handler:', error)
          }
        }
      }

      // Emit message event
      this.emit('message', serverClient, message)

      // Get multicast and trigger handlers
      const multicast = this.multicasts.get(channel)
      if (multicast) {
        // Trigger server-side receive handlers
        await multicast.handleMessage(
          dataMessage.data,
          serverClient,
          dataMessage,
        )

        // Relay the message to all other subscribers
        multicast.publish(dataMessage.data, serverClient.id)
      }
      return
    }

    // Emit message event for other types
    this.emit('message', serverClient, message)
  }

  /**
   * Handle a signal message
   */
  private async handleSignal(
    serverClient: ServerClient,
    signal: SignalType,
    channel: ChannelName | undefined,
  ): Promise<void> {
    if (!channel) {
      return
    }

    if (signal === CoreSignalType.SUBSCRIBE) {
      // Broadcast channel is always allowed
      if (channel === '__broadcast__') {
        // Send subscribed signal
        await serverClient.send({
          id: `signal-${Date.now()}`,
          type: MessageType.SIGNAL,
          signal: CoreSignalType.SUBSCRIBED,
          channel,
          timestamp: Date.now(),
        })
        return
      }

      // Execute subscribe middleware
      try {
        await this.middleware.executeSubscribe(serverClient, channel)
      } catch (error) {
        if (error instanceof MiddlewareRejectionError) {
          // Send error response
          await serverClient.send({
            id: `error-${Date.now()}`,
            type: MessageType.ERROR,
            data: {
              message: error.reason,
              code: 'SUBSCRIBE_REJECTED',
            },
            timestamp: Date.now(),
          })
          return
        }
        throw error
      }

      // Get or create multicast transport (auto-create on subscribe)
      let multicast = this.multicasts.get(channel)
      if (!multicast) {
        multicast = this.createMulticast(channel)
      }

      // Subscribe to channel in registry
      const subscribed = this.registry.subscribe(serverClient.id, channel)

      if (subscribed) {
        // Subscribe to multicast transport
        multicast.subscribe(serverClient.id)

        // Call handleSubscribe
        await multicast.handleSubscribe(serverClient)

        // Send subscribed signal
        await serverClient.send({
          id: `signal-${Date.now()}`,
          type: MessageType.SIGNAL,
          signal: CoreSignalType.SUBSCRIBED,
          channel,
          timestamp: Date.now(),
        })

        // Emit subscribe event
        this.emit('subscribe', serverClient, channel)
      }
    } else if (signal === CoreSignalType.UNSUBSCRIBE) {
      // Execute unsubscribe middleware
      try {
        await this.middleware.executeUnsubscribe(serverClient, channel)
      } catch (error) {
        if (error instanceof MiddlewareRejectionError) {
          // Send error response
          await serverClient.send({
            id: `error-${Date.now()}`,
            type: MessageType.ERROR,
            data: {
              message: error.reason,
              code: 'UNSUBSCRIBE_REJECTED',
            },
            timestamp: Date.now(),
          })
          return
        }
        throw error
      }

      // Unsubscribe from channel
      const unsubscribed = this.registry.unsubscribe(serverClient.id, channel)

      if (unsubscribed) {
        const multicast = this.multicasts.get(channel)
        if (multicast) {
          // Unsubscribe from multicast transport
          multicast.unsubscribe(serverClient.id)

          // Call handleUnsubscribe
          await multicast.handleUnsubscribe(serverClient)
        }

        // Send unsubscribed signal
        await serverClient.send({
          id: `signal-${Date.now()}`,
          type: MessageType.SIGNAL,
          signal: CoreSignalType.UNSUBSCRIBED,
          channel,
          timestamp: Date.now(),
        })

        // Emit unsubscribe event
        this.emit('unsubscribe', serverClient, channel)
      }
    } else if (signal === CoreSignalType.PING) {
      // Respond with pong
      await serverClient.send({
        id: `pong-${Date.now()}`,
        type: MessageType.SIGNAL,
        signal: CoreSignalType.PONG,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<E extends ServerEventType>(
    event: E,
    ...args: Parameters<ServerEventMap[E]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          ;(handler as any)(...args)
        } catch (error) {
          console.error(`Error in ${event} handler:`, error)
        }
      }
    }
  }
}

/**
 * Factory function to create a Synnel server
 */
export function createSynnelServer(config?: ServerConfig): SynnelServer {
  return new SynnelServer(config)
}
