/**
 * Base Channel
 * Abstract base class for channel implementations.
 */

import type {
  IPublishOptions,
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
  IChannelState,
  IChannelOptions,
  IChannelTransport,
  ChannelName,
  SubscriberId,
  DataMessage,
  Timestamp,
} from '../types'

/**
 * Abstract base channel class
 */
export abstract class BaseChannel<T = unknown> implements IChannelTransport<T> {
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
   */
  get subscriberCount(): number {
    return this.subscribers.size
  }

  // ============================================================
  // PUBLISH METHODS (implements IChannel<T>)
  // ============================================================

  /**
   * Publish data to channel subscribers
   */
  abstract publish(data: T, options?: IPublishOptions): void

  /**
   * Add a message to history (if history is enabled)
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
   */
  hasSubscriber(subscriber: SubscriberId): boolean {
    return this.subscribers.has(subscriber)
  }

  /**
   * Get all subscribers
   */
  getSubscribers(): Set<SubscriberId> {
    return new Set(this.subscribers)
  }

  /**
   * Check if channel is empty
   */
  isEmpty(): boolean {
    return this.subscribers.size === 0
  }

  /**
   * Check if channel is full
   */
  isFull(): boolean {
    return (
      this.options.maxSubscribers > 0 &&
      this.subscribers.size >= this.options.maxSubscribers
    )
  }

  /**
   * Check if this is a reserved channel
   */
  isReserved(): boolean {
    return this.options.reserved
  }

  // ============================================================
  // HISTORY METHODS (implements IMessageHistory<T>)
  // ============================================================

  /**
   * Get all messages in history
   */
  getHistory(): DataMessage<T>[] {
    return [...this.messageHistory]
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = []
    this._lastMessageAt = undefined
  }

  // ============================================================
  // HANDLER REGISTRATION (implements IChannelTransport<T>)
  // ============================================================

  /**
   * Register a handler for incoming messages
   */
  onMessage(handler: IMessageHandler<T>): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * Process an incoming message on this channel
   */
  async receive(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void> {
    await this.handleMessage(data, client, message)
  }

  /**
   * Register a handler for new subscriptions
   */
  onSubscribe(handler: ILifecycleHandler): () => void {
    this.subscribeHandlers.add(handler)
    return () => {
      this.subscribeHandlers.delete(handler)
    }
  }

  /**
   * Register a handler for unsubscriptions
   */
  onUnsubscribe(handler: ILifecycleHandler): () => void {
    this.unsubscribeHandlers.add(handler)
    return () => {
      this.unsubscribeHandlers.delete(handler)
    }
  }

  // ============================================================
  // SUBSCRIBE/UNSUBSCRIBE METHODS
  // ============================================================

  /**
   * Subscribe a client to this channel
   */
  subscribe(subscriber: SubscriberId): boolean {
    if (this.subscribers.has(subscriber)) {
      return false
    }

    if (this.isFull()) {
      return false
    }

    this.subscribers.add(subscriber)
    return true
  }

  /**
   * Unsubscribe a client from this channel
   */
  unsubscribe(subscriber: SubscriberId): boolean {
    return this.subscribers.delete(subscriber)
  }

  // ============================================================
  // PROTECTED HANDLER TRIGGER METHODS
  // ============================================================

  /**
   * Trigger message handlers
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
        console.error(
          `Error in message handler for channel ${this.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Trigger subscribe handlers
   */
  public async handleSubscribe(client: IClientConnection): Promise<void> {
    for (const handler of this.subscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(
          `Error in subscribe handler for channel ${this.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Trigger unsubscribe handlers
   */
  public async handleUnsubscribe(client: IClientConnection): Promise<void> {
    for (const handler of this.unsubscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(
          `Error in unsubscribe handler for channel ${this.name}:`,
          error,
        )
      }
    }
  }

  /**
   * Clear all subscribers
   */
  clear(): void {
    this.subscribers.clear()
  }
}
