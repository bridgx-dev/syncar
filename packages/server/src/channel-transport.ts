/**
 * Channel Transport
 * Handles per-channel message routing and subscriptions
 */

import type {
  ChannelTransport as IChannelTransport,
  ChannelState,
  ServerClient,
} from './types.js'
import type { ChannelName, DataMessage, Message } from '@synnel/core'
import { generateMessageId, createDataMessage } from '@synnel/core'
import type { ClientRegistry } from './client-registry.js'

/**
 * Channel Transport Implementation
 */
export class ChannelTransportImpl<T = unknown> implements IChannelTransport<T> {
  readonly name: ChannelName
  private state: ChannelState<T>

  constructor(
    name: ChannelName,
    private registry: ClientRegistry,
  ) {
    this.name = name
    this.state = {
      name,
      subscribers: new Set(),
      messageHandlers: new Set(),
      subscribeHandlers: new Set(),
      unsubscribeHandlers: new Set(),
    }
  }

  /**
   * Number of subscribers
   */
  get subscriberCount(): number {
    return this.state.subscribers.size
  }

  /**
   * Send data to all subscribers except optionally excluded client
   */
  async send(data: T, excludeClientId?: string): Promise<void> {
    const message = createDataMessage(this.name, data)
    await this._sendToSubscribers(message, excludeClientId)
  }

  /**
   * Send data to a specific client in the channel
   */
  async sendTo(clientId: string, data: T): Promise<void> {
    const client = this.registry.get(clientId)
    if (!client || !this.state.subscribers.has(clientId)) {
      throw new Error(`Client ${clientId} is not subscribed to channel ${this.name}`)
    }

    const message = createDataMessage(this.name, data)
    await client.send(message)
  }

  /**
   * Register a handler for incoming messages
   */
  onMessage(
    handler: (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>,
  ): () => void {
    this.state.messageHandlers.add(handler as any)
    return () => {
      this.state.messageHandlers.delete(handler as any)
    }
  }

  /**
   * Register a handler for incoming messages (alias for onMessage)
   * Provides a more intuitive API for receiving messages on a channel
   * @example
   * ```ts
   * const chat = synnel.multicast('chat')
   * chat.receive((data, client) => {
   *   console.log(`Received from ${client.id}:`, data)
   * })
   * ```
   */
  receive(
    handler: (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>,
  ): () => void {
    return this.onMessage(handler)
  }

  /**
   * Register a handler for new subscriptions
   */
  onSubscribe(
    handler: (client: ServerClient) => void | Promise<void>,
  ): () => void {
    this.state.subscribeHandlers.add(handler)
    return () => {
      this.state.subscribeHandlers.delete(handler)
    }
  }

  /**
   * Register a handler for unsubscriptions
   */
  onUnsubscribe(
    handler: (client: ServerClient) => void | Promise<void>,
  ): () => void {
    this.state.unsubscribeHandlers.add(handler)
    return () => {
      this.state.unsubscribeHandlers.delete(handler)
    }
  }

  /**
   * Get all subscribers
   */
  getSubscribers(): ServerClient[] {
    return this.registry.getSubscribers(this.name)
  }

  /**
   * Check if a client is subscribed
   */
  hasSubscriber(clientId: string): boolean {
    return this.state.subscribers.has(clientId)
  }

  /**
   * Handle a client subscription
   * Called by SynnelServer when a client subscribes
   */
  async handleSubscribe(client: ServerClient): Promise<void> {
    this.state.subscribers.add(client.id)

    // Call subscribe handlers
    for (const handler of this.state.subscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in subscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Handle a client unsubscription
   * Called by SynnelServer when a client unsubscribes
   */
  async handleUnsubscribe(client: ServerClient): Promise<void> {
    this.state.subscribers.delete(client.id)

    // Call unsubscribe handlers
    for (const handler of this.state.unsubscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in unsubscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Handle an incoming message
   * Called by SynnelServer when a message is received for this channel
   */
  async handleMessage(
    data: T,
    client: ServerClient,
    message: DataMessage<T>,
  ): Promise<void> {
    // Call message handlers
    for (const handler of this.state.messageHandlers) {
      try {
        await handler(data, client, message)
      } catch (error) {
        console.error(`Error in message handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Internal: Send message to all subscribers
   */
  private async _sendToSubscribers(
    message: Message,
    excludeClientId?: string,
  ): Promise<void> {
    const subscribers = this.getSubscribers()
    const promises: Promise<void>[] = []

    for (const subscriber of subscribers) {
      if (excludeClientId && subscriber.id === excludeClientId) {
        continue
      }

      promises.push(
        (async () => {
          try {
            await subscriber.send(message)
          } catch (error) {
            console.error(`Failed to send message to client ${subscriber.id}:`, error)
          }
        })(),
      )
    }

    await Promise.all(promises)
  }
}
