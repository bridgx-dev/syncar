/**
 * Channel Subscription
 * Manages a single channel subscription lifecycle
 */

import type { ChannelName, DataMessage } from '@synnel/core-v2'
import { SignalType } from '@synnel/core-v2'
import type {
  SubscriptionState,
  SubscribeOptions,
  SubscriptionCallbacks,
  MessageHandler,
} from './types.js'

/**
 * Channel Subscription Implementation
 * Handles the lifecycle of a single channel subscription
 */
export class ChannelSubscriptionImpl<T = unknown> {
  private _state: SubscriptionState = 'unsubscribed'
  public readonly autoResubscribe: boolean
  private messageHandlers: Set<MessageHandler<T>> = new Set()
  private subscribedAt: number | null = null

  // Callbacks
  private callbacks: SubscriptionCallbacks<T> = {}

  // Subscribe options data
  private subscribeData?: unknown

  /**
   * Send subscribe function - provided by client
   */
  sendSubscribe?: (channel: ChannelName, data?: unknown) => Promise<void>

  /**
   * Send unsubscribe function - provided by client
   */
  sendUnsubscribe?: (channel: ChannelName) => Promise<void>

  constructor(
    public readonly channel: ChannelName,
    options: SubscribeOptions & { callbacks?: SubscriptionCallbacks<T> } = {},
  ) {
    this.autoResubscribe = options.autoResubscribe ?? true
    this.subscribeData = options.data
    this.callbacks = options.callbacks || {}
  }

  /**
   * Current subscription state
   */
  get state(): SubscriptionState {
    return this._state
  }

  /**
   * Subscribe to the channel
   */
  async subscribe(options?: SubscribeOptions): Promise<void> {
    if (this._state === 'subscribed' || this._state === 'subscribing') {
      return
    }

    this._state = 'subscribing'

    try {
      // Update options if provided
      if (options) {
        this.subscribeData = options.data
      }

      if (this.sendSubscribe) {
        await this.sendSubscribe(this.channel, this.subscribeData)
      }

      // Note: State will be updated to 'subscribed' when SUBSCRIBED signal is received
    } catch (error) {
      this._state = 'unsubscribed'
      throw error
    }
  }

  /**
   * Unsubscribe from the channel
   */
  async unsubscribe(): Promise<void> {
    if (this._state === 'unsubscribed' || this._state === 'unsubscribing') {
      return
    }

    this._state = 'unsubscribing'

    try {
      if (this.sendUnsubscribe) {
        await this.sendUnsubscribe(this.channel)
      }

      // Note: State will be updated to 'unsubscribed' when UNSUBSCRIBED signal is received
    } catch (error) {
      this._state = 'subscribed'
      throw error
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(message: DataMessage<T>): void {
    if (message.channel !== this.channel) {
      return
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(message)
      } catch (error) {
        console.error(`Error in message handler for channel ${this.channel}:`, error)
      }
    }

    // Call callback if provided
    if (this.callbacks.onMessage) {
      try {
        this.callbacks.onMessage(message)
      } catch (error) {
        console.error(`Error in onMessage callback for channel ${this.channel}:`, error)
      }
    }
  }

  /**
   * Handle signal message
   */
  handleSignal(signal: SignalType): void {
    switch (signal) {
      case SignalType.SUBSCRIBED:
        if (this._state === 'subscribing') {
          this._state = 'subscribed'
          this.subscribedAt = Date.now()
          this.callbacks.onSubscribed?.()
        }
        break

      case SignalType.UNSUBSCRIBED:
        if (this._state === 'unsubscribing') {
          this._state = 'unsubscribed'
          this.subscribedAt = null
          this.callbacks.onUnsubscribed?.()
        }
        break
    }
  }

  /**
   * Handle subscription error
   */
  handleError(error: Error): void {
    this._state = 'unsubscribed'
    this.callbacks.onError?.(error)
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler<T>): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * Reset subscription state (for reconnection)
   */
  reset(): void {
    const wasSubscribed = this._state === 'subscribed'
    this._state = 'unsubscribed'
    this.subscribedAt = null

    // Auto-resubscribe if enabled and was previously subscribed
    if (this.autoResubscribe && wasSubscribed) {
      // The client will handle resubscription
    }
  }

  /**
   * Get subscription info
   */
  getInfo(): {
    channel: ChannelName
    state: SubscriptionState
    autoResubscribe: boolean
    subscribedAt?: number
  } {
    return {
      channel: this.channel,
      state: this._state,
      autoResubscribe: this.autoResubscribe,
      subscribedAt: this.subscribedAt ?? undefined,
    }
  }

  /**
   * Clear all handlers
   */
  destroy(): void {
    this.messageHandlers.clear()
    this.callbacks = {}
    this.sendSubscribe = undefined
    this.sendUnsubscribe = undefined
  }
}
