/**
 * Channel Types
 * Types for channel-based messaging including broadcast and multicast transports.
 */

import type { IChannel, IMessageHandler, ILifecycleHandler } from './base.js'
import type {
  ChannelName,
  ClientId,
  SubscriberId,
  DataMessage,
  Timestamp,
} from '@synnel/types'

// ============================================================
// CHANNEL STATE
// ============================================================

/**
 * Channel state information
 * Represents the public state of a channel.
 *
 * @example
 * ```ts
 * const state: IChannelState = {
 *   name: 'chat',
 *   subscriberCount: 42,
 *   createdAt: Date.now(),
 *   lastMessageAt: Date.now()
 * }
 * ```
 */
// Todo: This one can be picked from IInternalChannelState
export interface IChannelState {
  /** Channel name */
  name: ChannelName

  /** Number of active subscribers */
  subscriberCount: number

  /** Channel creation timestamp */
  createdAt: Timestamp

  /** Last message timestamp (undefined if no messages yet) */
  lastMessageAt?: Timestamp
}

// ============================================================
// CHANNEL OPTIONS
// ============================================================

/**
 * Channel creation and configuration options
 *
 * @example
 * ```ts
 * const options: IChannelOptions = {
 *   maxSubscribers: 100,
 *   reserved: false,
 *   historySize: 50
 * }
 *
 * server.createMulticast('chat', options)
 * ```
 */
export interface IChannelOptions {
  /**
   * Maximum number of subscribers (0 = unlimited)
   * @default 0
   */
  maxSubscribers?: number

  /**
   * Whether this channel is reserved (system use only)
   * Reserved channels cannot be subscribed to by regular clients
   * @default false
   */
  reserved?: boolean

  /**
   * Message history size (0 = no history)
   * When > 0, the channel keeps track of recent messages
   * @default 0
   */
  historySize?: number
}

// ============================================================
// MESSAGE HISTORY
// ============================================================

/**
 * Message history interface
 * Provides access to recent messages in a channel.
 *
 * @template T The type of messages stored
 *
 * @example
 * ```ts
 * const history: IMessageHistory<string> = {
 *   getHistory: () => [...messages],
 *   clearHistory: () => { messages.length = 0 }
 * }
 * ```
 */
export interface IMessageHistory<T> {
  /**
   * Get all messages in history
   *
   * @returns Array of historical messages
   */
  getHistory(): DataMessage<T>[]

  /**
   * Clear message history
   */
  clearHistory(): void
}

// ============================================================
// CHANNEL TRANSPORT INTERFACE
// ============================================================

/**
 * Channel transport interface
 * Extends IChannel with message handling capabilities.
 *
 * Channel transports represent topic-based messaging where clients
 * can subscribe to receive messages only for that channel.
 *
 * @template T The type of data published on this channel
 *
 * @example
 * ```ts
 * const chat: IChannelTransport<string> = server.createMulticast('chat')
 *
 * // Subscribe to messages
 * chat.receive((data, client) => {
 *   console.log(`Received from ${client.id}:`, data)
 * })
 *
 * // Publish to all subscribers
 * chat.publish('Hello everyone!')
 * ```
 */
export interface IChannelTransport<T> extends IChannel<T>, IMessageHistory<T> {
  /**
   * Register a handler for incoming messages on this channel
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * const unsubscribe = channel.onMessage((data, client) => {
   *   console.log(`Received from ${client.id}:`, data)
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  onMessage(handler: IMessageHandler<T>): () => void

  /**
   * Register a handler for incoming messages (alias for onMessage)
   * Provides a more intuitive API for receiving messages.
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
  receive(handler: IMessageHandler<T>): () => void

  /**
   * Register a handler for new subscriptions
   *
   * @param handler - Function to handle new subscriptions
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * channel.onSubscribe((client) => {
   *   console.log(`${client.id} joined the channel`)
   *   await sendWelcomeMessage(client)
   * })
   * ```
   */
  onSubscribe(handler: ILifecycleHandler): () => void

  /**
   * Register a handler for unsubscriptions
   *
   * @param handler - Function to handle unsubscriptions
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * channel.onUnsubscribe((client) => {
   *   console.log(`${client.id} left the channel`)
   * })
   * ```
   */
  onUnsubscribe(handler: ILifecycleHandler): () => void

  /**
   * Get the current state of the channel
   *
   * @returns Channel state information
   */
  getState(): IChannelState

  /**
   * Check if a subscriber is in this channel
   *
   * @param subscriber - Subscriber ID to check
   * @returns true if subscribed, false otherwise
   */
  hasSubscriber(subscriber: SubscriberId): boolean

  /**
   * Get all subscribers
   *
   * @returns Set of subscriber IDs
   */
  getSubscribers(): Set<SubscriberId>

  /**
   * Check if channel is empty (no subscribers)
   *
   * @returns true if empty, false otherwise
   */
  isEmpty(): boolean

  /**
   * Check if channel is full (at max subscribers)
   *
   * @returns true if full, false otherwise
   */
  isFull(): boolean

  /**
   * Check if this is a reserved channel
   *
   * @returns true if reserved, false otherwise
   */
  isReserved(): boolean
}

// ============================================================
// BROADCAST TRANSPORT INTERFACE
// ============================================================

/**
 * Broadcast transport interface
 * Server-to-all communication channel that reaches every connected client.
 *
 * Unlike multicast channels, broadcast does not require subscription.
 * All connected clients receive broadcast messages.
 *
 * @template T The type of data broadcast
 *
 * @example
 * ```ts
 * const broadcast: IBroadcastTransport<string> = server.createBroadcast()
 *
 * // Send to all connected clients
 * broadcast.publish('Server maintenance in 5 minutes')
 *
 * // Send to all except one client
 * broadcast.publishExcept('You have been logged out', excludedClientId)
 * ```
 */
export interface IBroadcastTransport<T> {
  /**
   * Channel name (always '__broadcast__')
   */
  readonly name: '__broadcast__'

  /**
   * Publish data to ALL connected clients
   *
   * @param data - The data to broadcast
   */
  publish(data: T): void

  /**
   * Publish data to all clients except the specified one
   *
   * @param data - The data to broadcast
   * @param excludeClientId - Client ID to exclude from broadcast
   */
  // Todo: We can use published with excludeClientId as an optional parameter instead of a separate method
  publishExcept(data: T, excludeClientId: ClientId): void
}

// ============================================================
// MULTICAST TRANSPORT INTERFACE
// ============================================================

/**
 * Multicast transport interface
 * Topic-based messaging where only subscribed clients receive messages.
 *
 * This is an alias for IChannelTransport for semantic clarity.
 *
 * @template T The type of data published on this channel
 *
 * @example
 * ```ts
 * const chat: IMulticastTransport<string> = server.createMulticast('chat')
 *
 * // Client subscribes (client-side)
 * client.subscribe('chat')
 *
 * // Server publishes to subscribers only
 * chat.publish('Welcome to the chat!')
 * ```
 */
export type IMulticastTransport<T> = IChannelTransport<T>

// ============================================================
// INTERNAL CHANNEL STATE
// ============================================================

/**
 * Internal channel state (used by implementations)
 * Contains all the state needed for channel management.
 *
 * This is an internal type - external code should use IChannelState.
 *
 * @template T The type of data in the channel
 */
export interface IInternalChannelState<T = unknown> {
  /** Channel name */
  name: ChannelName

  /** Subscribed client IDs */
  subscribers: Set<SubscriberId>

  /** Message handlers */
  messageHandlers: Set<IMessageHandler<T>>

  /** Subscribe handlers */
  subscribeHandlers: Set<ILifecycleHandler>

  /** Unsubscribe handlers */
  unsubscribeHandlers: Set<ILifecycleHandler>

  /** Message history */
  messageHistory: DataMessage<T>[]

  /** Channel options */
  options: Required<IChannelOptions>

  /** Creation timestamp */
  createdAt: Timestamp

  /** Last message timestamp */
  lastMessageAt?: Timestamp
}

// ============================================================
// MESSAGE BUS OPTIONS
// ============================================================

/**
 * Message bus configuration options
 * Configures default behavior for channel management.
 *
 * @example
 * ```ts
 * const options: IMessageBusOptions = {
 *   defaultChannelOptions: { maxSubscribers: 100 },
 *   autoCreateChannels: true,
 *   autoDeleteEmptyChannels: true,
 *   emptyChannelGracePeriod: 5000
 * }
 * ```
 */
export interface IMessageBusOptions {
  /**
   * Default options for newly created channels
   */
  defaultChannelOptions?: IChannelOptions

  /**
   * Automatically create channels when clients subscribe
   * @default false
   */
  autoCreateChannels?: boolean

  /**
   * Automatically delete empty channels
   * @default false
   */
  autoDeleteEmptyChannels?: boolean

  /**
   * Grace period in milliseconds before deleting empty channel
   * Only used if autoDeleteEmptyChannels is true
   * @default 5000
   */
  emptyChannelGracePeriod?: number
}
