/**
 * Base Channel
 * Abstract base class for channel implementations.
 *
 * Provides common functionality for all channel types including
 * state management, subscriber tracking, message history, and
 * handler registration.
 *
 * @module channel/base-channel
 */

import type {
  IChannel,
  IPublishOptions,
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
} from '../types/base.js'
import type {
  IChannelState,
  IChannelOptions,
  IChannelTransport,
  IMessageHistory,
} from '../types/channel.js'
import type {
  ChannelName,
  SubscriberId,
  ClientId,
  DataMessage,
  Timestamp,
} from '@synnel/types'
import { createDataMessage } from '@synnel/lib'

// ============================================================
// BASE CHANNEL CLASS
// ============================================================

/**
 * Abstract base channel class
 *
 * Provides common functionality for all channel implementations.
 * Extending classes must implement handler registration methods.
 *
 * @template T The type of data published on this channel
 *
 * @example
 * ```ts
 * import { BaseChannel } from '@synnel/server/channel'
 *
 * class MyChannel<T> extends BaseChannel<T> implements IChannelTransport<T> {
 *   // Implement abstract methods: onMessage, receive, onSubscribe, onUnsubscribe
 *   // inherit: publish, getState, hasSubscriber, getSubscribers, isEmpty, etc.
 * }
 * ```
 */
export abstract class BaseChannel<T = unknown>
  implements IChannel<T>, IMessageHistory<T>
{
  /**
   * Channel name (readonly)
   */
  public readonly name: ChannelName

  /**
   * Channel creation timestamp
   */
  protected readonly _createdAt: Timestamp

  /**
   * Last message timestamp (undefined if no messages yet)
   */
  protected _lastMessageAt?: Timestamp

  /**
   * Subscribed client IDs
   */
  protected subscribers: Set<SubscriberId> = new Set()

  /**
   * Message handlers for incoming messages
   */
  protected messageHandlers: Set<IMessageHandler<T>> = new Set()

  /**
   * Subscribe handlers for new subscriptions
   */
  protected subscribeHandlers: Set<ILifecycleHandler> = new Set()

  /**
   * Unsubscribe handlers for disconnections
   */
  protected unsubscribeHandlers: Set<ILifecycleHandler> = new Set()

  /**
   * Message history (enabled when options.historySize > 0)
   */
  protected messageHistory: DataMessage<T>[] = []

  /**
   * Channel configuration options
   */
  protected readonly options: Required<IChannelOptions>

  /**
   * Create a new BaseChannel
   *
   * @param name - Channel name
   * @param options - Channel configuration options
   *
   * @example
   * ```ts
   * const channel = new BaseChannel('chat', {
   *   maxSubscribers: 100,
   *   reserved: false,
   *   historySize: 50
   * })
   * ```
   */
  constructor(name: ChannelName, options: IChannelOptions = {}) {
    this.name = name
    this._createdAt = Date.now()
    this.options = {
      maxSubscribers: options.maxSubscribers ?? 0,
      reserved: options.reserved ?? false,
      historySize: options.historySize ?? 0,
    }
  }

  /**
   * Get the current subscriber count
   * Used for IChannel.subscriberCount
   */
  get subscriberCount(): number {
    return this.subscribers.size
  }

  // ============================================================
  // PUBLISH METHODS (implements IChannel<T>)
  // ============================================================

  /**
   * Publish data to channel subscribers
   * Abstract method - subclasses must implement the actual sending logic
   *
   * @param data - The data to publish
   * @param options - Optional publish options for filtering recipients
   *
   * @example
   * ```ts
   * // Send to all subscribers
   * channel.publish('Hello everyone!')
   *
   * // Send to specific subscribers
   * channel.publish('Private message', { to: ['client-1', 'client-2'] })
   *
   * // Send to all except specific subscribers
   * channel.publish('Hello', { exclude: ['client-3'] })
   * ```
   */
  abstract publish(data: T, options?: IPublishOptions): void

  /**
   * Add a message to history (if history is enabled)
   * Called by subclasses when publishing messages
   *
   * @param message - The message to add to history
   *
   * @example
   * ```ts
   * // In subclass publish method
   * const message = createDataMessage(this.name, data)
   * this.addToHistory(message)
   * ```
   */
  protected addToHistory(message: DataMessage<T>): void {
    this._lastMessageAt = message.timestamp
    if (this.options.historySize > 0) {
      this.messageHistory.push(message)
      if (this.messageHistory.length > this.options.historySize) {
        this.messageHistory.shift()
      }
    }
  }

  // ============================================================
  // STATE METHODS (implements IChannelTransport<T> state methods)
  // ============================================================

  /**
   * Get the current state of the channel
   *
   * @returns Channel state information
   *
   * @example
   * ```ts
   * const state = channel.getState()
   * console.log(`Channel ${state.name} has ${state.subscriberCount} subscribers`)
   * ```
   */
  getState(): IChannelState {
    return {
      name: this.name,
      subscriberCount: this.subscribers.size,
      createdAt: this._createdAt,
      lastMessageAt: this._lastMessageAt,
    }
  }

  /**
   * Check if a subscriber is in this channel
   *
   * @param subscriber - Subscriber ID to check
   * @returns true if subscribed, false otherwise
   *
   * @example
   * ```ts
   * if (channel.hasSubscriber('client-123')) {
   *   console.log('Client is subscribed')
   * }
   * ```
   */
  hasSubscriber(subscriber: SubscriberId): boolean {
    return this.subscribers.has(subscriber)
  }

  /**
   * Get all subscribers
   *
   * @returns Set of subscriber IDs (copy to prevent external modification)
   *
   * @example
   * ```ts
   * const subscribers = channel.getSubscribers()
   * console.log(`Subscribers: ${Array.from(subscribers).join(', ')}`)
   * ```
   */
  getSubscribers(): Set<SubscriberId> {
    return new Set(this.subscribers)
  }

  /**
   * Check if channel is empty (no subscribers)
   *
   * @returns true if empty, false otherwise
   *
   * @example
   * ```ts
   * if (channel.isEmpty()) {
   *   console.log('No subscribers in this channel')
   * }
   * ```
   */
  isEmpty(): boolean {
    return this.subscribers.size === 0
  }

  /**
   * Check if channel is full (at max subscribers)
   *
   * @returns true if full, false otherwise
   *
   * @example
   * ```ts
   * if (channel.isFull()) {
   *   console.log('Channel is at maximum capacity')
   * }
   * ```
   */
  isFull(): boolean {
    return (
      this.options.maxSubscribers > 0 &&
      this.subscribers.size >= this.options.maxSubscribers
    )
  }

  /**
   * Check if this is a reserved channel
   *
   * @returns true if reserved, false otherwise
   *
   * @example
   * ```ts
   * if (channel.isReserved()) {
   *   console.log('This is a system-reserved channel')
   * }
   * ```
   */
  isReserved(): boolean {
    return this.options.reserved
  }

  // ============================================================
  // HISTORY METHODS (implements IMessageHistory<T>)
  // ============================================================

  /**
   * Get all messages in history
   * Returns a copy to prevent external modification
   *
   * @returns Array of historical messages
   *
   * @example
   * ```ts
   * const recentMessages = channel.getHistory()
   * recentMessages.forEach(msg => {
   *   console.log(`[${msg.timestamp}] ${msg.data}`)
   * })
   * ```
   */
  getHistory(): DataMessage<T>[] {
    return [...this.messageHistory]
  }

  /**
   * Clear message history
   *
   * @example
   * ```ts
   * channel.clearHistory()
   * console.log('Message history cleared')
   * ```
   */
  clearHistory(): void {
    this.messageHistory = []
    this._lastMessageAt = undefined
  }

  // ============================================================
  // ABSTRACT HANDLER METHODS
  // ============================================================

  /**
   * Register a handler for incoming messages on this channel
   * Subclasses must implement this method
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * // In subclass
   * onMessage(handler: IMessageHandler<T>): () => void {
   *   this.messageHandlers.add(handler)
   *   return () => {
   *     this.messageHandlers.delete(handler)
   *   }
   * }
   * ```
   */
  abstract onMessage(handler: IMessageHandler<T>): () => void

  /**
   * Register a handler for incoming messages (alias for onMessage)
   * Subclasses must implement this method
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * // In subclass
   * receive(handler: IMessageHandler<T>): () => void {
   *   return this.onMessage(handler)
   * }
   * ```
   */
  abstract receive(handler: IMessageHandler<T>): () => void

  /**
   * Register a handler for new subscriptions
   * Subclasses must implement this method
   *
   * @param handler - Function to handle new subscriptions
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * // In subclass
   * onSubscribe(handler: ILifecycleHandler): () => void {
   *   this.subscribeHandlers.add(handler)
   *   return () => {
   *     this.subscribeHandlers.delete(handler)
   *   }
   * }
   * ```
   */
  abstract onSubscribe(handler: ILifecycleHandler): () => void

  /**
   * Register a handler for unsubscriptions
   * Subclasses must implement this method
   *
   * @param handler - Function to handle unsubscriptions
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * // In subclass
   * onUnsubscribe(handler: ILifecycleHandler): () => void {
   *   this.unsubscribeHandlers.add(handler)
   *   return () => {
   *     this.unsubscribeHandlers.delete(handler)
   *   }
   * }
   * ```
   */
  abstract onUnsubscribe(handler: ILifecycleHandler): () => void

  // ============================================================
  // PROTECTED HANDLER TRIGGER METHODS
  // ============================================================

  /**
   * Trigger message handlers (called by subclasses when message received)
   *
   * @param data - The message data
   * @param client - The client that sent the message
   * @param message - The full message object
   *
   * @example
   * ```ts
   * // In subclass, when receiving a message from a client
   * await this.handleMessage(data, client, message)
   * ```
   */
  protected async handleMessage(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(data, client, message)
      } catch (error) {
        console.error(`Error in message handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Trigger subscribe handlers (called by subclasses when client subscribes)
   *
   * @param client - The client that subscribed
   *
   * @example
   * ```ts
   * // In subclass, when a client subscribes
   * await this.handleSubscribe(client)
   * ```
   */
  protected async handleSubscribe(client: IClientConnection): Promise<void> {
    for (const handler of this.subscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in subscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Trigger unsubscribe handlers (called by subclasses when client unsubscribes)
   *
   * @param client - The client that unsubscribed
   *
   * @example
   * ```ts
   * // In subclass, when a client unsubscribes
   * await this.handleUnsubscribe(client)
   * ```
   */
  protected async handleUnsubscribe(client: IClientConnection): Promise<void> {
    for (const handler of this.unsubscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in unsubscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Clear all subscribers (e.g., on shutdown)
   *
   * @example
   * ```ts
   * channel.clear()
   * console.log('All subscribers removed')
   * ```
   */
  clear(): void {
    this.subscribers.clear()
  }
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IChannel,
  IPublishOptions,
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
} from '../types/base.js'

export type {
  IChannelState,
  IChannelOptions,
  IChannelTransport,
  IMessageHistory,
} from '../types/channel.js'
