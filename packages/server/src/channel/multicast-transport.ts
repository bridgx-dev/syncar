/**
 * Multicast Transport
 * Topic-based messaging where only subscribed clients receive messages.
 */

import type {
  IClientConnection,
  IChannelTransport,
  IChannelOptions,
  ChannelName,
  ClientId,
  DataMessage,
} from '../types'
import { BaseChannel } from './base-channel'
import type { IPublishOptions } from '../types'
import { createDataMessage } from '@synnel/lib'

/**
 * Multicast Transport - sends messages only to subscribed clients
 */
export class MulticastTransport<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T> {
  /**
   * Map of all connected clients (reference to transport connections)
   */
  protected readonly clients: Map<ClientId, IClientConnection>

  /**
   * Create a new MulticastTransport
   */
  constructor(
    name: ChannelName,
    clients: Map<ClientId, IClientConnection>,
    options: IChannelOptions = {},
  ) {
    super(name, options)
    this.clients = clients
  }

  /**
   * Publish data to channel subscribers
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
  // INTERNAL SEND METHODS
  // ============================================================

  /**
   * Send message to all subscribers
   */
  protected sendToAllSubscribers(message: DataMessage<T>): void {
    for (const subscriberId of this.subscribers) {
      const client = this.clients.get(subscriberId)
      if (!client) continue

      try {
        client.socket.send(JSON.stringify(message), () => { })
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
        client.socket.send(JSON.stringify(message), () => { })
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
        client.socket.send(JSON.stringify(message), () => { })
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
   */
  publishTo(clientId: ClientId, data: T): void {
    const client = this.clients.get(clientId)
    if (!client || !this.subscribers.has(clientId)) {
      return
    }

    const message = createDataMessage(this.name, data)
    this.addToHistory(message)

    try {
      client.socket.send(JSON.stringify(message), () => { })
    } catch (error) {
      console.error(
        `Failed to publish to ${clientId} in channel ${this.name}:`,
        error,
      )
    }
  }
}
