/**
 * ChannelRef
 * Lightweight channel reference that implements IChannelTransport using closures.
 *
 * ChannelRef acts as a thin wrapper around the registry state, delegating
 * all operations to the registry and handler registry via closures.
 *
 * This design allows channels to be created without storing their own state,
 * making them lightweight and efficient.
 */

import type {
  IChannelTransport,
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
  IPublishOptions,
  IMiddleware,
  IClientRegistry,
} from '../types'
import type { ChannelName, SubscriberId, ClientId } from '../types'
import type { HandlerRegistry } from '../registry/handler-registry'
import type { DataMessage } from '../types/message'
import { BaseChannel } from './base-channel'

/**
 * ChannelRef - Lightweight channel reference
 *
 * Implements IChannelTransport by delegating to registry state via closures.
 * Does not store any state itself - all state is in the registry.
 *
 * @template T The type of data published on this channel
 */
export class ChannelRef<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T> {
  /**
   * Channel-specific middleware functions
   */
  private readonly middlewares: IMiddleware[] = []

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
    registry: IClientRegistry,
    private readonly _getSubscribers: () => Set<SubscriberId>,
    private readonly handlers: HandlerRegistry,
    private readonly subscribeFn: (clientId: SubscriberId) => boolean,
    private readonly unsubscribeFn: (clientId: SubscriberId) => boolean,
    chunkSize: number = 500,
  ) {
    super(name, registry, chunkSize)
  }

  /**
   * Get the list of client IDs that should receive the message
   */
  protected getTargetClients(_options?: IPublishOptions): ClientId[] {
    return Array.from(this._getSubscribers())
  }

  /**
   * Register a channel-specific middleware function
   *
   * @param middleware - The middleware to register
   */
  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware)
  }

  /**
   * Get all channel-specific middleware
   *
   * @returns Array of middleware functions
   */
  getMiddlewares(): IMiddleware[] {
    return [...this.middlewares]
  }

  // ============================================================
  // IChannel implementation
  // ============================================================

  /**
   * Get the number of subscribers to this channel
   */
  get subscriberCount(): number {
    return this._getSubscribers().size
  }


  // ============================================================
  // IChannelTransport implementation
  // ============================================================

  /**
   * Register a handler for incoming messages on this channel
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function
   */
  onMessage(handler: IMessageHandler<T>): () => void {
    return this.handlers.addMessageHandler(this.name, handler as IMessageHandler<unknown>)
  }

  /**
   * Subscribe a client to this channel
   *
   * @param subscriber - Subscriber ID to subscribe
   * @returns true if subscribed, false otherwise
   */
  subscribe(subscriber: SubscriberId): boolean {
    return this.subscribeFn(subscriber)
  }

  /**
   * Unsubscribe a client from this channel
   *
   * @param subscriber - Subscriber ID to unsubscribe
   * @returns true if unsubscribed, false otherwise
   */
  unsubscribe(subscriber: SubscriberId): boolean {
    return this.unsubscribeFn(subscriber)
  }

  /**
   * Process an incoming message on this channel
   *
   * Triggers all registered message handlers.
   *
   * @param data - The message data
   * @param client - The client that sent the message
   * @param message - The original data message
   */
  async receive(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void> {
    const handlers = this.handlers.getMessageHandlers(this.name)

    for (const handler of handlers) {
      try {
        await handler(data, client, message as any)
      } catch (error) {
        console.error(`Error in message handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Register a handler for new subscriptions
   *
   * @param handler - Function to handle new subscriptions
   * @returns Unsubscribe function
   */
  onSubscribe(handler: ILifecycleHandler): () => void {
    return this.handlers.addSubscribeHandler(this.name, handler)
  }

  /**
   * Register a handler for unsubscriptions
   *
   * @param handler - Function to handle unsubscriptions
   * @returns Unsubscribe function
   */
  onUnsubscribe(handler: ILifecycleHandler): () => void {
    return this.handlers.addUnsubscribeHandler(this.name, handler)
  }

  /**
   * Trigger subscription lifecycle handlers
   *
   * Called by the signal handler after a successful subscribe.
   *
   * @param client - The client that subscribed
   */
  async handleSubscribe(client: IClientConnection): Promise<void> {
    const handlers = this.handlers.getSubscribeHandlers(this.name)

    for (const handler of handlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in subscribe handler for channel ${this.name}:`, error)
        // Re-throw to allow blocking subscription on handler error
        throw error
      }
    }
  }

  /**
   * Trigger unsubscription lifecycle handlers
   *
   * Called by the signal handler after a successful unsubscribe.
   *
   * @param client - The client that unsubscribed
   */
  async handleUnsubscribe(client: IClientConnection): Promise<void> {
    const handlers = this.handlers.getUnsubscribeHandlers(this.name)

    for (const handler of handlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(`Error in unsubscribe handler for channel ${this.name}:`, error)
      }
    }
  }

  /**
   * Check if a subscriber is in this channel
   *
   * @param subscriber - Subscriber ID to check
   * @returns true if subscribed, false otherwise
   */
  hasSubscriber(subscriber: SubscriberId): boolean {
    return this._getSubscribers().has(subscriber)
  }

  /**
   * Get all subscribers
   *
   * @returns Set of subscriber IDs
   */
  getSubscribers(): Set<SubscriberId> {
    // Return a copy to prevent external modification
    return new Set(this._getSubscribers())
  }

  /**
   * Check if channel is empty (no subscribers)
   *
   * @returns true if empty, false otherwise
   */
  isEmpty(): boolean {
    return this._getSubscribers().size === 0
  }
}
