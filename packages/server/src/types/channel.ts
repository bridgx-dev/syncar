/**
 * Channel Types
 * Types for channel-based messaging including broadcast and multicast transports.
 */

import type {
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
  IPublishOptions,
} from './base'
import type { ChannelName, SubscriberId, Timestamp } from './common'
import type { DataMessage } from './message'
import { IMiddleware } from './middleware'

// ============================================================
// CHANNEL STATE
// ============================================================

/**
 * Channel state information
 * Represents the public state of a channel.
 *
 * This is the public API for channel state.
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
 * // Subscribe a client
 * chatChannel.subscribe('client-1')
 *
 * // Subscribe to connection events
 * chatChannel.onSubscribe((client) => {
 *   console.log(`${client.id} joined`)
 * })
 *
 * // Publish to all subscribers
 * chatChannel.publish('Hello everyone!')
 *
 * // Get subscriber count
 * console.log(`Subscribers: ${chatChannel.subscriberCount}`)
 * ```
 */
export interface IChannelTransport<T> extends IChannel<T> {
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
   * Subscribe a client to this channel
   *
   * @param subscriber - Subscriber ID to subscribe
   * @returns true if subscribed, false otherwise
   */
  subscribe(subscriber: SubscriberId): boolean

  /**
   * Unsubscribe a client from this channel
   *
   * @param subscriber - Subscriber ID to unsubscribe
   * @returns true if unsubscribed, false otherwise
   */
  unsubscribe(subscriber: SubscriberId): boolean

  /**
   * Process an incoming message on this channel
   *
   * @param data - The message data
   * @param client - The client that sent the message
   * @param message - The original data message
   */
  receive(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void>

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
   */
  onUnsubscribe(handler: ILifecycleHandler): () => void

  /**
   * Trigger subscription lifecycle handlers
   *
   * @param client - The client that subscribed
   */
  handleSubscribe(client: IClientConnection): Promise<void>

  /**
   * Trigger unsubscription lifecycle handlers
   *
   * @param client - The client that unsubscribed
   */
  handleUnsubscribe(client: IClientConnection): Promise<void>

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
   * Register a middleware for this channel
   *
   * @param middleware - Middleware to register
   */
  use(middleware: IMiddleware): void
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
// CHANNEL CLASSES
// ============================================================

/**
 * Base Channel implementation
 * Handles the complexities of chunked publishing and filtering.
 *
 * @template T - Type of data published on this channel
 * @template N - Type of the channel name
 */
export declare abstract class BaseChannel<
  T = unknown,
  N extends ChannelName = ChannelName,
> implements IChannel<T> {
  /**
   * Channel name
   */
  readonly name: N

  /**
   * Create a new BaseChannel
   *
   * @param name - Channel name
   * @param registry - Client registry for connection lookups
   * @param chunkSize - Maximum number of subscribers to process in a single chunk
   */
  constructor(
    name: N,
    registry: import('./client').IClientRegistry,
    chunkSize?: number,
  )

  /**
   * Get the number of subscribers
   */
  abstract get subscriberCount(): number

  /**
   * Check if channel is empty
   */
  abstract isEmpty(): boolean

  /**
   * Publish data to subscribers
   *
   * @param data - The data to publish
   * @param options - Optional publish options (to, exclude)
   */
  publish(data: T, options?: IPublishOptions): void

  /**
   * Get the list of client IDs that should receive the message
   *
   * @param options - Optional publish options
   * @returns Array of client IDs
   */
  protected abstract getTargetClients(
    options?: IPublishOptions,
  ): readonly string[]

  /**
   * Internal helper to publish to a set of clients synchronously
   */
  protected publishToClients(
    data: T,
    clientIds: readonly string[],
    options?: IPublishOptions,
  ): void

  /**
   * Publish data to clients in chunks using setImmediate
   */
  protected publishInChunks(
    data: T,
    clientIds: readonly string[],
    options?: IPublishOptions,
  ): void
}

/**
 * Broadcast Channel - sends messages to ALL connected clients
 *
 * @template T - Type of data to be published
 *
 * @example
 * ```ts
 * const broadcast = new BroadcastChannel(registry)
 * broadcast.publish('Hello everyone!')
 * ```
 */
export declare class BroadcastChannel<T = unknown>
  extends BaseChannel<T, '__broadcast__'>
  implements IBroadcastTransport<T> {
  /**
   * Create a new BroadcastChannel
   *
   * @param registry - Client registry for connection lookups
   * @param chunkSize - Maximum number of subscribers to process in a single chunk
   */
  constructor(registry: import('./client').IClientRegistry, chunkSize?: number)

  /**
   * Broadcast channels always have all current connections as targets
   */
  protected getTargetClients(_options?: IPublishOptions): readonly string[]

  /**
   * Broadcast channels effectively have all clients as "subscribers"
   */
  get subscriberCount(): number

  /**
   * Broadcast channels are never empty if someone is connected
   */
  isEmpty(): boolean
}

/**
 * ChannelRef - Lightweight channel reference
 *
 * Implements IChannelTransport by delegating to registry state via closures.
 * Does not store any state itself - all state is in the registry.
 *
 * @template T - The type of data published on this channel
 *
 * @example
 * ```ts
 * const channel = new ChannelRef('chat', registry, ...)
 * channel.publish({ text: 'Hello' })
 * ```
 */
export declare class ChannelRef<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T> {
  /**
   * Create a new ChannelRef
   *
   * @param name - Channel name
   * @param registry - Client registry for connection lookups
   * @param _getSubscribers - Function to get the subscriber set for this channel
   * @param handlers - Handler registry for channel event handlers
   * @param subscribeFn - Function to subscribe a client to this channel
   * @param unsubscribeFn - Function to unsubscribe a client from this channel
   * @param chunkSize - Maximum number of subscribers to process in a single chunk
   */
  constructor(
    name: ChannelName,
    registry: import('./client').IClientRegistry,
    _getSubscribers: () => Set<string>,
    handlers: import('./handler-registry').HandlerRegistry,
    subscribeFn: (clientId: string) => boolean,
    unsubscribeFn: (clientId: string) => boolean,
    chunkSize?: number,
  )

  /**
   * Register a channel-specific middleware function
   *
   * @param middleware - The middleware to register
   */
  use(middleware: import('./middleware').IMiddleware): void

  /**
   * Get all channel-specific middleware
   *
   * @returns Array of middleware functions
   */
  getMiddlewares(): import('./middleware').IMiddleware[]

  /**
   * Get the list of client IDs that should receive the message
   */
  protected getTargetClients(_options?: IPublishOptions): readonly string[]

  /**
   * Get the number of subscribers to this channel
   */
  get subscriberCount(): number

  /**
   * Register a handler for incoming messages on this channel
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   */
  onMessage(handler: IMessageHandler<T>): () => void

  /**
   * Subscribe a client to this channel
   *
   * @param subscriber - Subscriber ID to subscribe
   * @returns true if subscribed, false otherwise
   */
  subscribe(subscriber: string): boolean

  /**
   * Unsubscribe a client from this channel
   *
   * @param subscriber - Subscriber ID to unsubscribe
   * @returns true if unsubscribed, false otherwise
   */
  unsubscribe(subscriber: string): boolean

  /**
   * Process an incoming message on this channel
   *
   * @param data - The message data
   * @param client - The client that sent the message
   * @param message - The original data message
   */
  receive(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void>

  /**
   * Register a handler for new subscriptions
   *
   * @param handler - Function to handle new subscriptions
   * @returns Unsubscribe function
   */
  onSubscribe(handler: ILifecycleHandler): () => void

  /**
   * Register a handler for unsubscriptions
   *
   * @param handler - Function to handle unsubscriptions
   * @returns Unsubscribe function
   */
  onUnsubscribe(handler: ILifecycleHandler): () => void

  /**
   * Trigger subscription lifecycle handlers
   *
   * @param client - The client that subscribed
   */
  handleSubscribe(client: IClientConnection): Promise<void>

  /**
   * Trigger unsubscription lifecycle handlers
   *
   * @param client - The client that unsubscribed
   */
  handleUnsubscribe(client: IClientConnection): Promise<void>

  /**
   * Check if a subscriber is in this channel
   *
   * @param subscriber - Subscriber ID to check
   * @returns true if subscribed, false otherwise
   */
  hasSubscriber(subscriber: string): boolean

  /**
   * Get all subscribers
   *
   * @returns Set of subscriber IDs
   */
  getSubscribers(): Set<string>

  /**
   * Check if channel is empty (no subscribers)
   *
   * @returns true if empty, false otherwise
   */
  isEmpty(): boolean
}
