/**
 * Broadcast Transport
 * Server-to-all communication channel that reaches every connected client.
 */

import type { IPublishOptions, IClientConnection } from '../types/base.js'
import type { IBroadcastTransport } from '../types/channel.js'
import type { ClientId, DataMessage, SubscriberId } from '@synnel/types'
import { createDataMessage } from '@synnel/lib'
import { BROADCAST_CHANNEL } from '../config/constants.js'
import { BaseChannel } from './base-channel.js'

/**
 * Broadcast Transport - sends messages to ALL connected clients
 */
export class BroadcastTransport<T = unknown>
  extends BaseChannel<T>
  implements IBroadcastTransport<T>
{
  /**
   * Channel name (always '__broadcast__')
   */
  public override readonly name: '__broadcast__' = BROADCAST_CHANNEL

  /**
   * Map of all connected clients
   */
  protected readonly clients: Map<ClientId, IClientConnection>

  /**
   * Create a new BroadcastTransport
   */
  constructor(clients: Map<ClientId, IClientConnection>) {
    super(BROADCAST_CHANNEL)
    this.clients = clients
  }

  /**
   * Get the current subscriber count
   * For broadcast, this is the total number of connected clients
   */
  public override get subscriberCount(): number {
    return this.clients.size
  }

  /**
   * For broadcast, everyone is always "subscribed"
   */
  public override subscribe(_subscriber: SubscriberId): boolean {
    return true
  }

  /**
   * For broadcast, unsubscription is a no-op
   */
  public override unsubscribe(_subscriber: SubscriberId): boolean {
    return true
  }

  // ============================================================
  // PUBLISH METHODS (implements IChannel<T>)
  // ============================================================

  /**
   * Publish data to connected clients
   */
  publish(data: T, options?: IPublishOptions): void {
    const message = createDataMessage(this.name, data)

    // Add to history if enabled
    this.addToHistory(message)

    // If no options, send to all clients
    if (!options) {
      this.sendToAll(message)
      return
    }

    // If `to` is specified, only send to those clients (excluding those in `exclude`)
    if (options.to && options.to.length > 0) {
      this.sendToSpecific(message, options.to, options.exclude)
      return
    }

    // If only `exclude` is specified, send to all except those
    if (options.exclude && options.exclude.length > 0) {
      this.sendToAllExcept(message, options.exclude)
      return
    }

    // Default: send to all
    this.sendToAll(message)
  }

  // ============================================================
  // INTERNAL SEND METHODS
  // ============================================================

  /**
   * Send message to all connected clients
   */
  protected sendToAll(message: DataMessage<T>): void {
    for (const client of this.clients.values()) {
      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Failed to publish broadcast to ${client.id}:`, error)
      }
    }
  }

  /**
   * Send message to all clients except specified ones
   */
  protected sendToAllExcept(
    message: DataMessage<T>,
    excludeIds: readonly ClientId[],
  ): void {
    const excludeSet = new Set(excludeIds)

    for (const [id, client] of this.clients) {
      if (excludeSet.has(id)) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Failed to publish broadcast to ${client.id}:`, error)
      }
    }
  }

  /**
   * Send message to specific clients, with optional exclusions
   */
  protected sendToSpecific(
    message: DataMessage<T>,
    toIds: readonly ClientId[],
    excludeIds?: readonly ClientId[],
  ): void {
    const toSet = new Set(toIds)
    const excludeSet = new Set(excludeIds ?? [])

    for (const [id, client] of this.clients) {
      // Must be in `to` list and not in `exclude` list
      if (!toSet.has(id)) continue
      if (excludeSet.has(id)) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Failed to publish broadcast to ${client.id}:`, error)
      }
    }
  }
}

// ============================================================
// RE-EXPORT BROADCAST CHANNEL CONSTANT
// ============================================================

export { BROADCAST_CHANNEL } from '../config/constants.js'
