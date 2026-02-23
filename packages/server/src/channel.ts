/**
 * Server Channel Transport Implementations
 * Broadcast and Multicast transports for real-time messaging
 */

import type {
  ChannelName,
  ClientId,
  SubscriberId,
} from '@synnel/types'
import type { DataMessage } from '@synnel/types'
import { createDataMessage } from '@synnel/lib'
import type { ChannelState, ChannelOptions } from '@synnel/types'
import { isValidChannelName, isReservedChannelName } from '@synnel/lib'
import type { ClientConnection, ServerClient } from './types.js'

/**
 * Re-export ChannelState from types for convenience
 */
export type { ChannelState, ChannelOptions } from '@synnel/types'

// ============================================================
// BROADCAST TRANSPORT
// ============================================================

/**
 * Broadcast Transport - sends messages to ALL connected clients
 * This is a server-to-client only channel (one-way communication)
 */
export class BroadcastTransport<T = unknown> {
  public readonly name = '__broadcast__'
  protected readonly clients: Map<ClientId, ClientConnection>

  constructor(clients: Map<ClientId, ClientConnection>) {
    this.clients = clients
  }

  /**
   * Publish data to ALL connected clients
   * @param data - The data to publish
   */
  publish(data: T): void {
    const message = createDataMessage(this.name, data)

    for (const [_, client] of this.clients) {
      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Failed to publish broadcast to ${client.id}:`, error)
      }
    }
  }

  /**
   * Publish data to all clients except the specified one
   * @param data - The data to publish
   * @param excludeClientId - Client ID to exclude from broadcast
   */
  publishExcept(data: T, excludeClientId: ClientId): void {
    const message = createDataMessage(this.name, data)

    for (const [id, client] of this.clients) {
      if (id === excludeClientId) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Failed to publish broadcast to ${client.id}:`, error)
      }
    }
  }
}

// ============================================================
// MULTICAST TRANSPORT
// ============================================================

/**
 * Multicast Transport - sends messages only to subscribed clients
 * This is the standard channel for topic-based messaging
 */
export class MulticastTransport<T = unknown> {
  public readonly name: ChannelName
  protected readonly clients: Map<ClientId, ClientConnection>
  protected readonly subscribers: Set<SubscriberId> = new Set()
  protected messageHistory: DataMessage<T>[] = []
  protected readonly options: Required<ChannelOptions>
  protected readonly _createdAt: number
  protected _lastMessageAt?: number

  // Handler sets
  protected messageHandlers: Set<
    (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>
  > = new Set()
  protected subscribeHandlers: Set<
    (client: ServerClient) => void | Promise<void>
  > = new Set()
  protected unsubscribeHandlers: Set<
    (client: ServerClient) => void | Promise<void>
  > = new Set()

  constructor(
    name: ChannelName,
    clients: Map<ClientId, ClientConnection>,
    options: ChannelOptions = {},
  ) {
    this.name = name
    this.clients = clients
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

  /**
   * Get channel information
   */
  getState(): ChannelState<T> {
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

  /**
   * Subscribe a client to this channel
   * @returns true if subscription succeeded, false otherwise
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

    this.subscribers.add(subscriber)
    return true
  }

  /**
   * Unsubscribe a client from this channel
   * @returns true if subscriber was removed, false if not found
   */
  unsubscribe(subscriber: SubscriberId): boolean {
    return this.subscribers.delete(subscriber)
  }

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

  /**
   * Get message history
   */
  getHistory(): DataMessage<T>[] {
    return [...this.messageHistory]
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = []
  }

  /**
   * Clear all subscribers (e.g., on shutdown)
   */
  clear(): void {
    this.subscribers.clear()
  }

  /**
   * Send data to all subscribers except optionally excluded client
   */
  async send(data: T, excludeClientId?: ClientId): Promise<void> {
    const message = createDataMessage(this.name, data)
    this.addToHistory(message)

    const promises: Promise<void>[] = []

    for (const [id, client] of this.clients) {
      // Only send to subscribers, and exclude specified client
      if (!this.subscribers.has(id)) continue
      if (excludeClientId && id === excludeClientId) continue

      promises.push(
        new Promise<void>((resolve) => {
          try {
            client.socket.send(JSON.stringify(message))
            resolve()
          } catch (error) {
            console.error(`Failed to send to ${client.id}:`, error)
            resolve()
          }
        })
      )
    }

    await Promise.all(promises)
  }

  /**
   * Send data to a specific client in the channel
   */
  async sendTo(clientId: ClientId, data: T): Promise<void> {
    const client = this.clients.get(clientId)
    if (!client || !this.subscribers.has(clientId)) {
      return
    }

    const message = createDataMessage(this.name, data)
    client.socket.send(JSON.stringify(message))
  }

  /**
   * Register a handler for incoming messages on this channel
   */
  onMessage(
    handler: (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>,
  ): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * Register a handler for incoming messages (alias for onMessage)
   * Provides a more intuitive API for receiving messages on a channel
   */
  receive(
    handler: (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>,
  ): () => void {
    return this.onMessage(handler)
  }

  /**
   * Register a handler for new subscriptions
   */
  onSubscribe(
    handler: (client: ServerClient) => void | Promise<void>,
  ): () => void {
    this.subscribeHandlers.add(handler)
    return () => {
      this.subscribeHandlers.delete(handler)
    }
  }

  /**
   * Register a handler for unsubscriptions
   */
  onUnsubscribe(
    handler: (client: ServerClient) => void | Promise<void>,
  ): () => void {
    this.unsubscribeHandlers.add(handler)
    return () => {
      this.unsubscribeHandlers.delete(handler)
    }
  }

  /**
   * Trigger message handlers (called by server when message received)
   */
  async handleMessage(
    data: T,
    client: ServerClient,
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
   * Trigger subscribe handlers
   */
  async handleSubscribe(client: ServerClient): Promise<void> {
    for (const handler of this.subscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in subscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Trigger unsubscribe handlers
   */
  async handleUnsubscribe(client: ServerClient): Promise<void> {
    for (const handler of this.unsubscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in unsubscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Validate channel name (using @synnel/lib utility)
   */
  static isValidChannelName(name: ChannelName): boolean {
    return isValidChannelName(name)
  }

  /**
   * Check if channel name is reserved (using @synnel/lib utility)
   */
  static isReservedName(name: ChannelName): boolean {
    return isReservedChannelName(name)
  }
}
