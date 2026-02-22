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
} from './types.js'
import type { Message, DataMessage, ChannelName, SignalType } from '@synnel/core-v2'
import { MessageType, SignalType as CoreSignalType } from '@synnel/core-v2'
import type { ServerTransport } from '@synnel/adapter-ws-v2'
import { WebSocketServerTransport } from '@synnel/adapter-ws-v2'
import { ClientRegistry } from './client-registry.js'
import { MiddlewareManager, MiddlewareRejectionError } from './middleware.js'
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
  private registry: ClientRegistry
  private middleware: MiddlewareManager
  private channels: Map<ChannelName, InternalChannel> = new Map()
  private broadcastHandlers: Set<
    (data: unknown, client: ServerClient, message: DataMessage<unknown>) => void | Promise<void>
  > = new Set()
  private eventHandlers: Map<ServerEventType, Set<any>> = new Map()
  private allowedChannels?: Set<ChannelName>
  private started = false
  private messagesReceived = 0
  private messagesSent = 0
  private startedAt?: number

  constructor(config: ServerConfig = {}) {
    // Use provided transport or create default
    this.transport = config.transport ?? new WebSocketServerTransport()

    // Initialize components
    this.registry = new ClientRegistry()
    this.middleware = new MiddlewareManager()

    // Store allowed channels if provided
    if (config.channels) {
      this.allowedChannels = new Set(config.channels)
      // Add channel whitelist middleware
      this.middleware.use(
        ((allowed: Set<string>) => {
          return async ({ action, channel, reject }) => {
            if ((action === 'subscribe' || action === 'message') && channel && !allowed.has(channel)) {
              reject(`Channel '${channel}' is not allowed`)
            }
          }
        })(this.allowedChannels),
      )
    }

    // Add provided middleware
    if (config.middleware) {
      for (const mw of config.middleware) {
        this.middleware.use(mw)
      }
    }

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

    await this.transport.start()
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

    await this.transport.stop()
    this.started = false
    this.startedAt = undefined
    this.registry.clear()
    this.channels.clear()
  }

  /**
   * Get a channel transport
   * Creates the channel if it doesn't exist
   */
  async channel<T = unknown>(name: ChannelName): Promise<ChannelTransport<T>> {
    // Check if channel is allowed
    if (this.allowedChannels && !this.allowedChannels.has(name)) {
      throw new Error(`Channel '${name}' is not allowed`)
    }

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
        mode: transportInfo.mode,
        path: transportInfo.path,
        port: transportInfo.port,
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
   * Set up transport event handlers
   */
  private setupTransportHandlers(): void {
    // Handle new connections
    this.transport.on('connection', async (clientId) => {
      await this.handleConnection(clientId)
    })

    // Handle disconnections
    this.transport.on('disconnection', async (clientId, event) => {
      await this.handleDisconnection(clientId, event)
    })

    // Handle incoming messages
    this.transport.on('message', async (clientId, message) => {
      await this.handleMessage(clientId, message)
    })

    // Handle errors
    this.transport.on('error', (error) => {
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
      // Check if channel is allowed
      if (this.allowedChannels && !this.allowedChannels.has(channel)) {
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
        const channelTransport = this.channel(channel)
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
