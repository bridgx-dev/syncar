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
 * This is the public API for channel state - IInternalChannelState extends this
 * to add implementation details while ensuring all public properties are available.
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
 * // Type declaration for a channel with message history
 * interface IChatChannel extends IChannelTransport<string>, IMessageHistory<string> {
 *   // Inherits getHistory() and clearHistory() methods
 * }
 *
 * // Usage
 * const messages = channel.getHistory()
 * channel.clearHistory()
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
 * // Type declaration for a string-based chat channel
 * const chatChannel: IChannelTransport<string> = ...
 *
 * // Subscribe to incoming messages
 * chatChannel.receive((data, client) => {
 *   console.log(`Received from ${client.id}:`, data)
 * })
 *
 * // Subscribe to connection events
 * chatChannel.onSubscribe((client) => {
 *   console.log(`${client.id} joined`)
 * })
 *
 * // Publish to all subscribers
 * chatChannel.publish('Hello everyone!')
 *
 * // Get channel state
 * const state = chatChannel.getState()
 * console.log(`Channel ${state.name} has ${state.subscriberCount} subscribers`)
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
 * Extends IChannel<T> for consistent publish API across all channel types.
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
 * // Send to all except specific clients
 * broadcast.publish('You have been logged out', { exclude: ['client-123'] })
 *
 * // Send to specific clients only
 * broadcast.publish('Private announcement', { to: ['client-1', 'client-2'] })
 * ```
 */
export interface IBroadcastTransport<T> extends IChannel<T> {
  /**
   * Channel name (always '__broadcast__')
   */
  readonly name: '__broadcast__'
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
 * Extends IChannelState to include all public state properties,
 * plus internal implementation details.
 *
 * This is an internal type - external code should use IChannelState.
 *
 * @template T The type of data in the channel
 *
 * @example
 * ```ts
 * // Internal state includes public properties (name, subscriberCount, etc.)
 * // plus implementation details
 * const internalState: IInternalChannelState<string> = {
 *   // Public properties from IChannelState
 *   name: 'chat',
 *   subscriberCount: 10,
 *   createdAt: Date.now(),
 *   lastMessageAt: Date.now(),
 *
 *   // Internal properties
 *   subscribers: new Set(['client-1', 'client-2']),
 *   messageHandlers: new Set(),
 *   subscribeHandlers: new Set(),
 *   unsubscribeHandlers: new Set(),
 *   messageHistory: [],
 *   options: { maxSubscribers: 100, reserved: false, historySize: 50 }
 * }
 * ```
 */
export interface IInternalChannelState<T = unknown> extends IChannelState {
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
