/**
 * Synnel Server
 * Main server class for real-time WebSocket communication
 */

import type {
  ServerConfig,
  ServerStats,
  ServerClient,
  ChannelTransport,
  BroadcastTransport,
  ServerEventType,
  ServerEventMap,
  DisconnectionEvent,
  MiddlewareContext,
} from './types.js'
import type { Message, DataMessage, ChannelName, SignalType } from '@synnel/core'
import { MessageType, SignalType as CoreSignalType } from '@synnel/core'
import type { ServerTransport } from '@synnel/adapter'
import { WebSocketServerTransport } from '@synnel/adapter/server'
import { ClientRegistry } from './client-registry.js'
import { MiddlewareManager, MiddlewareRejectionError } from './middleware.js'
import { createServer } from 'http'
// Import ChannelTransportImpl at the bottom to avoid circular dependency
import type { ChannelTransportImpl } from './channel-transport.js'

/**
 * Internal channel state
 */
interface InternalChannel<T = unknown> {
  transport: ChannelTransport<T>
  messageHandlers: Set<(data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>>
}

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
  private channels: Map<ChannelName, InternalChannel> = new Map()
  private broadcastHandlers: Set<
    (data: unknown, client: ServerClient, message: DataMessage<unknown>) => void | Promise<void>
  > = new Set()
  private eventHandlers: Map<ServerEventType, Set<any>> = new Map()
  private createdChannels: Set<ChannelName> = new Set()
  private started = false
  private messagesReceived = 0
  private messagesSent = 0
  private startedAt?: number

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
        path: '/synnel',
        enablePing: config.enablePing ?? true,
        pingInterval: config.pingInterval ?? 5000,
        pingTimeout: config.pingTimeout,
      })
    }

    // Add provided middleware
    config.middleware?.forEach((mw) => this.middleware.use(mw))

    // Set up transport event handlers
    this.setupTransportHandlers()
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
    this.channels.clear()

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
   * Get a channel transport
   * Creates the channel if it doesn't exist
   * Note: For client subscriptions, channel must be created via multicast() first
   */
  async channel<T = unknown>(name: ChannelName): Promise<ChannelTransport<T>> {
    let channel = this.channels.get(name)
    if (!channel) {
      // Import ChannelTransportImpl dynamically to avoid circular dependency
      const { ChannelTransportImpl } = await import('./channel-transport.js')
      const impl = new ChannelTransportImpl(name, this.registry) as ChannelTransportImpl<T>

      // Set up message handler for this channel
      impl.onMessage((data: T, client: ServerClient, message: DataMessage<T>) => {
        const handlers = this.channels.get(name)?.messageHandlers
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(data, client, message as any)
            } catch (error) {
              console.error(`Error in message handler for channel ${name}:`, error)
            }
          }
        }
      })

      channel = {
        transport: impl,
        messageHandlers: new Set(),
      }
      this.channels.set(name, channel)
    }

    return channel.transport as ChannelTransport<T>
  }

  /**
   * Get the broadcast transport
   */
  broadcastTransport<T = unknown>(): BroadcastTransport<T> {
    const self = this

    return {
      async send(data: T): Promise<void> {
        const message = {
          id: `broadcast-${Date.now()}`,
          type: MessageType.DATA,
          channel: '__broadcast__',
          data,
          timestamp: Date.now(),
        } as DataMessage<T>

        const clients = self.registry.getAll()
        const promises: Promise<void>[] = []

        for (const client of clients) {
          promises.push(
            (async () => {
              try {
                await client.send(message)
                self.messagesSent++
              } catch (error) {
                console.error(`Failed to send broadcast to ${client.id}:`, error)
              }
            })(),
          )
        }

        await Promise.all(promises)
      },

      async sendExcept(data: T, excludeClientId: string): Promise<void> {
        const message = {
          id: `broadcast-${Date.now()}`,
          type: MessageType.DATA,
          channel: '__broadcast__',
          data,
          timestamp: Date.now(),
        } as DataMessage<T>

        const clients = self.registry.getAll()
        const promises: Promise<void>[] = []

        for (const client of clients) {
          if (client.id === excludeClientId) continue

          promises.push(
            (async () => {
              try {
                await client.send(message)
                self.messagesSent++
              } catch (error) {
                console.error(`Failed to send broadcast to ${client.id}:`, error)
              }
            })(),
          )
        }

        await Promise.all(promises)
      },

      onMessage(
        handler: (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>,
      ): () => void {
        self.broadcastHandlers.add(handler as any)
        return () => {
          self.broadcastHandlers.delete(handler as any)
        }
      },
    }
  }

  /**
   * Check if a channel exists
   */
  hasChannel(name: ChannelName): boolean {
    return this.channels.has(name)
  }

  /**
   * Get all active channels
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channels.keys())
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
    const transportInfo = this.transport.getServerInfo()

    return {
      clientCount: this.registry.getCount(),
      channelCount: this.channels.size,
      subscriptionCount: this.registry.getTotalSubscriptionCount(),
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      startedAt: this.startedAt,
      transport: {
        path: transportInfo.path,
      },
    }
  }

  /**
   * Use a middleware function
   */
  use(middleware: Parameters<MiddlewareManager['use']>[0]): void {
    this.middleware.use(middleware)
  }

  /**
   * Create a multicast channel (many-to-many messaging)
   * All subscribers can send and receive messages
   * This marks the channel as "created" - only created channels can be subscribed to by clients
   * @param name - Channel name
   * @returns Channel transport with send/receive methods
   */
  async multicast<T = unknown>(name: ChannelName): Promise<ChannelTransport<T>> {
    // Mark this channel as created/allowed
    this.createdChannels.add(name)
    return await this.channel<T>(name)
  }

  /**
   * Create a broadcast channel (server-to-all messaging)
   * Messages sent to all connected clients
   * @returns Broadcast transport
   */
  broadcast<T = unknown>(): BroadcastTransport<T> {
    return this.broadcastTransport<T>()
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
    handler: (clientId: string, channel: string, action: string) => boolean | Promise<boolean>,
  ): () => void {
    const middleware = async ({ client, channel, action, reject }: MiddlewareContext) => {
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
  onMessage(handler: (client: ServerClient, message: Message) => void): () => void {
    return this.on('message', handler)
  }

  /**
   * Set up transport event handlers
   */
  private setupTransportHandlers(): void {
    // Handle new connections
    this.transport.on('connection', async (clientId: string) => {
      await this.handleConnection(clientId)
    })

    // Handle disconnections
    this.transport.on('disconnection', async (clientId: string, event: { wasClean: boolean; code: number; reason: string }) => {
      await this.handleDisconnection(clientId, event)
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
  private async handleConnection(clientId: string): Promise<void> {
    const connection = this.transport.getClient(clientId)
    if (!connection) {
      return
    }

    // Register the client
    const serverClient = this.registry.register(clientId, this.transport, connection)

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
  private async handleDisconnection(
    clientId: string,
    event: { wasClean: boolean; code: number; reason: string },
  ): Promise<void> {
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
    for (const channel of subscriptions) {
      const channelData = this.channels.get(channel)
      if (channelData) {
        // Call unsubscribe handlers
        const impl = channelData.transport as any
        if (impl.handleUnsubscribe) {
          await impl.handleUnsubscribe(serverClient)
        }
      }
    }

    // Unregister the client
    this.registry.unregister(clientId)

    // Emit disconnection event
    const disconnectionEvent: DisconnectionEvent = {
      wasClean: event.wasClean,
      code: event.code,
      reason: event.reason,
    }
    this.emit('disconnection', serverClient, disconnectionEvent)
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(clientId: string, message: Message): Promise<void> {
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
      await this.handleSignal(serverClient, message.signal as SignalType, message.channel)
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

      // Get or create channel and trigger handlers
      const channelData = this.channels.get(channel)
      if (channelData) {
        const impl = channelData.transport as any
        if (impl.handleMessage) {
          await impl.handleMessage(dataMessage.data, serverClient, dataMessage)
        }
      }

      // Relay to other subscribers
      await this.relayMessage(serverClient, dataMessage)
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
      // Check if channel was explicitly created via multicast()
      // Broadcast channel is always allowed
      if (channel !== '__broadcast__' && !this.createdChannels.has(channel)) {
        await serverClient.send({
          id: `error-${Date.now()}`,
          type: MessageType.ERROR,
          data: {
            message: `Channel '${channel}' is not allowed`,
            code: 'CHANNEL_NOT_ALLOWED',
          },
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

      // Subscribe to channel
      const subscribed = this.registry.subscribe(serverClient.id, channel)

      if (subscribed) {
        // Get or create channel transport
        const channelTransport = await this.channel(channel)
        const impl = channelTransport as any

        // Call internal handleSubscribe if available
        if (impl.handleSubscribe) {
          await impl.handleSubscribe(serverClient)
        }

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
        const channelData = this.channels.get(channel)
        if (channelData) {
          const impl = channelData.transport as any
          if (impl.handleUnsubscribe) {
            await impl.handleUnsubscribe(serverClient)
          }
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
   * Relay a message to all subscribers except the sender
   */
  private async relayMessage(
    sender: ServerClient,
    message: DataMessage,
  ): Promise<void> {
    const channel = message.channel
    if (!channel) {
      return
    }

    const channelTransport = this.channels.get(channel)
    if (!channelTransport) {
      return
    }

    const subscribers = this.registry.getSubscribers(channel)
    const promises: Promise<void>[] = []

    for (const subscriber of subscribers) {
      if (subscriber.id === sender.id) {
        continue // Don't echo back to sender
      }

      promises.push(
        (async () => {
          try {
            await subscriber.send(message)
            this.messagesSent++
          } catch (error) {
            console.error(`Failed to relay message to ${subscriber.id}:`, error)
          }
        })(),
      )
    }

    await Promise.all(promises)
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
          ; (handler as any)(...args)
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
