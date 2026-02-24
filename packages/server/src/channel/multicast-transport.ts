/**
 * Multicast Transport
 * Topic-based messaging where only subscribed clients receive messages.
 *
 * This is the standard channel for topic-based pub/sub communication.
 * Clients must explicitly subscribe to receive messages on this channel.
 *
 * @module channel/multicast-transport
 */

import type {
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
} from '../types/base.js'
import type {
  IChannelTransport,
  IChannelOptions,
  IChannelState,
} from '../types/channel.js'
import type {
  ChannelName,
  SubscriberId,
  ClientId,
  DataMessage,
  Timestamp,
} from '@synnel/types'
import { BaseChannel } from './base-channel.js'
import type { IPublishOptions } from '../types/base.js'
import { createDataMessage } from '@synnel/lib'

// ============================================================
// MULTICAST TRANSPORT CLASS
// ============================================================

/**
 * Multicast Transport - sends messages only to subscribed clients
 *
 * This is the standard channel for topic-based messaging where clients
 * can subscribe to receive messages only for that channel.
 *
 * Extends BaseChannel to inherit state management, subscriber tracking,
 * and message history functionality.
 *
 * @template T The type of data published on this channel
 *
 * @example
 * ```ts
 * import { MulticastTransport } from '@synnel/server/channel'
 *
 * const chat = new MulticastTransport<string>('chat', clientsMap, {
 *   maxSubscribers: 100,
 *   historySize: 50
 * })
 *
 * // Subscribe a client
 * chat.subscribe('client-123')
 *
 * // Register message handler
 * chat.receive((data, client) => {
 *   console.log(`Received from ${client.id}:`, data)
 * })
 *
 * // Register subscription handler
 * chat.onSubscribe((client) => {
 *   console.log(`${client.id} joined the channel`)
 * })
 *
 * // Publish to all subscribers
 * chat.publish('Hello everyone!')
 *
 * // Publish to specific subscribers
 * chat.publish('Private message', { to: ['client-1', 'client-2'] })
 *
 * // Unsubscribe a client
 * chat.unsubscribe('client-123')
 * ```
 */
export class MulticastTransport<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T>
{
  /**
   * Map of all connected clients (reference to transport connections)
   * Used for sending messages to subscribed clients
   */
  protected readonly clients: Map<ClientId, IClientConnection>

  /**
   * Create a new MulticastTransport
   *
   * @param name - Channel name
   * @param clients - Map of all connected clients
   * @param options - Channel configuration options
   *
   * @example
   * ```ts
   * const transport = new WebSocketServerTransport({ server: httpServer })
   * const chat = new MulticastTransport('chat', transport.connections, {
   *   maxSubscribers: 100,
   *   reserved: false,
   *   historySize: 50
   * })
   * ```
   */
  constructor(
    name: ChannelName,
    clients: Map<ClientId, IClientConnection>,
    options: IChannelOptions = {},
  ) {
    super(name, options)
    this.clients = clients
  }

  // ============================================================
  // PUBLISH METHODS (implements IChannel<T>)
  // ============================================================

  /**
   * Publish data to channel subscribers
   *
   * Without options: sends to all subscribed clients
   * With options: filters recipients based on `to` and `exclude`
   *
   * @param data - The data to publish
   * @param options - Optional publish options for filtering recipients
   *
   * @example
   * ```ts
   * // Send to all subscribers
   * chat.publish('Hello everyone!')
   *
   * // Send to specific subscribers only
   * chat.publish('Private message', { to: ['client-1', 'client-2'] })
   *
   * // Send to all subscribers except specific ones
   * chat.publish('Hello', { exclude: ['client-3'] })
   *
   * // Combine to and exclude
   * chat.publish('Message', {
   *   to: ['client-1', 'client-2', 'client-3'],
   *   exclude: ['client-2']
   * }) // Only sends to client-1 and client-3
   * ```
   */
  publish(data: T, options?: IPublishOptions): void {
    const message = createDataMessage(this.name, data)

    // Add to history if enabled
    this.addToHistory(message)

    // If no options, send to all subscribers
    if (!options) {
      this.sendToAllSubscribers(message)
      return
    }

    // If `to` is specified, only send to those subscribers (excluding those in `exclude`)
    if (options.to && options.to.length > 0) {
      this.sendToSpecificSubscribers(message, options.to, options.exclude)
      return
    }

    // If only `exclude` is specified, send to all subscribers except those
    if (options.exclude && options.exclude.length > 0) {
      this.sendToAllSubscribersExcept(message, options.exclude)
      return
    }

    // Default: send to all subscribers
    this.sendToAllSubscribers(message)
  }

  // ============================================================
  // SUBSCRIBE/UNSUBSCRIBE METHODS
  // ============================================================

  /**
   * Subscribe a client to this channel
   *
   * @param subscriber - Subscriber ID (typically client ID)
   * @returns true if subscription succeeded, false if already subscribed or channel is full
   *
   * @example
   * ```ts
   * const success = chat.subscribe('client-123')
   * if (success) {
   *   console.log('Client subscribed successfully')
   * } else if (chat.isFull()) {
   *   console.log('Channel is full')
   * }
   * ```
   */
  subscribe(subscriber: SubscriberId): boolean {
    // Check if already subscribed
    if (this.subscribers.has(subscriber)) {
      return false
    }

    // Check if channel is full
    if (this.isFull()) {
      return false
    }

    // Add to subscribers
    this.subscribers.add(subscriber)
    return true
  }

  /**
   * Unsubscribe a client from this channel
   *
   * @param subscriber - Subscriber ID (typically client ID)
   * @returns true if subscriber was removed, false if not found
   *
   * @example
   * ```ts
   * const removed = chat.unsubscribe('client-123')
   * if (removed) {
   *   console.log('Client unsubscribed successfully')
   * }
   * ```
   */
  unsubscribe(subscriber: SubscriberId): boolean {
    return this.subscribers.delete(subscriber)
  }

  // ============================================================
  // HANDLER REGISTRATION (implements IChannelTransport<T>)
  // ============================================================

  /**
   * Register a handler for incoming messages on this channel
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = chat.onMessage((data, client) => {
   *   console.log(`Received from ${client.id}:`, data)
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  onMessage(handler: IMessageHandler<T>): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * Register a handler for incoming messages (alias for onMessage)
   * Provides a more intuitive API for receiving messages
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * chat.receive((data, client) => {
   *   console.log(`Received: ${data}`)
   * })
   * ```
   */
  receive(handler: IMessageHandler<T>): () => void {
    return this.onMessage(handler)
  }

  /**
   * Register a handler for new subscriptions
   *
   * @param handler - Function to handle new subscriptions
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = chat.onSubscribe((client) => {
   *   console.log(`${client.id} joined the channel`)
   *   await sendWelcomeMessage(client)
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  onSubscribe(handler: ILifecycleHandler): () => void {
    this.subscribeHandlers.add(handler)
    return () => {
      this.subscribeHandlers.delete(handler)
    }
  }

  /**
   * Register a handler for unsubscriptions
   *
   * @param handler - Function to handle unsubscriptions
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = chat.onUnsubscribe((client) => {
   *   console.log(`${client.id} left the channel`)
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  onUnsubscribe(handler: ILifecycleHandler): () => void {
    this.unsubscribeHandlers.add(handler)
    return () => {
      this.unsubscribeHandlers.delete(handler)
    }
  }

  // ============================================================
  // LIFECYCLE HANDLER TRIGGERS
  // ============================================================

  /**
   * Trigger subscribe handlers (called by server when client subscribes)
   *
   * @param client - The client that subscribed
   *
   * @example
   * ```ts
   * // In server, when a client subscribes
   * await multicast.handleSubscribe(client)
   * ```
   */
  override async handleSubscribe(client: IClientConnection): Promise<void> {
    return super.handleSubscribe(client)
  }

  /**
   * Trigger unsubscribe handlers (called by server when client unsubscribes)
   *
   * @param client - The client that unsubscribed
   *
   * @example
   * ```ts
   * // In server, when a client unsubscribes
   * await multicast.handleUnsubscribe(client)
   * ```
   */
  override async handleUnsubscribe(client: IClientConnection): Promise<void> {
    return super.handleUnsubscribe(client)
  }

  /**
   * Trigger message handlers (called by server when message received)
   *
   * @param data - The message data
   * @param client - The client that sent the message
   * @param message - The full message object
   *
   * @example
   * ```ts
   * // In server, when receiving a message from a client
   * await multicast.handleMessage(data, client, message)
   * ```
   */
  override async handleMessage(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void> {
    return super.handleMessage(data, client, message)
  }

  // ============================================================
  // INTERNAL SEND METHODS
  // ============================================================

  /**
   * Send message to all subscribers
   *
   * @param message - The message to send
   */
  protected sendToAllSubscribers(message: DataMessage<T>): void {
    for (const subscriberId of this.subscribers) {
      const client = this.clients.get(subscriberId)
      if (!client) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(
          `Failed to publish to ${subscriberId} in channel ${this.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Send message to all subscribers except specified ones
   *
   * @param message - The message to send
   * @param excludeIds - Subscriber IDs to exclude
   */
  protected sendToAllSubscribersExcept(
    message: DataMessage<T>,
    excludeIds: readonly ClientId[],
  ): void {
    const excludeSet = new Set(excludeIds)

    for (const subscriberId of this.subscribers) {
      if (excludeSet.has(subscriberId)) continue

      const client = this.clients.get(subscriberId)
      if (!client) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(
          `Failed to publish to ${subscriberId} in channel ${this.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Send message to specific subscribers, with optional exclusions
   *
   * @param message - The message to send
   * @param toIds - Subscriber IDs to send to
   * @param excludeIds - Optional subscriber IDs to exclude from the `to` list
   */
  protected sendToSpecificSubscribers(
    message: DataMessage<T>,
    toIds: readonly ClientId[],
    excludeIds?: readonly ClientId[],
  ): void {
    const toSet = new Set(toIds)
    const excludeSet = new Set(excludeIds ?? [])

    for (const subscriberId of this.subscribers) {
      // Must be in `to` list and not in `exclude` list
      if (!toSet.has(subscriberId)) continue
      if (excludeSet.has(subscriberId)) continue

      const client = this.clients.get(subscriberId)
      if (!client) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(
          `Failed to publish to ${subscriberId} in channel ${this.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Publish data to a specific subscriber in the channel
   * Convenience method for direct client communication
   *
   * @param clientId - The client ID to send to
   * @param data - The data to publish
   *
   * @example
   * ```ts
   * chat.publishTo('client-123', { type: 'direct_message', text: 'Hello!' })
   * ```
   */
  publishTo(clientId: ClientId, data: T): void {
    const client = this.clients.get(clientId)
    if (!client || !this.subscribers.has(clientId)) {
      return
    }

    const message = createDataMessage(this.name, data)
    this.addToHistory(message)

    try {
      client.socket.send(JSON.stringify(message))
    } catch (error) {
      console.error(`Failed to publish to ${clientId} in channel ${this.name}:`, error)
    }
  }
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IChannelTransport,
  IChannelOptions,
  IChannelState,
} from '../types/channel.js'

export type {
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
} from '../types/base.js'

export type {
  ChannelName,
  SubscriberId,
  ClientId,
  DataMessage,
} from '@synnel/types'
