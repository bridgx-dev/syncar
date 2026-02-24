/**
 * Broadcast Transport
 * Server-to-all communication channel that reaches every connected client.
 *
 * Unlike multicast channels, broadcast does not require subscription.
 * All connected clients receive broadcast messages.
 *
 * @module channel/broadcast-transport
 */

import type { IPublishOptions, IClientConnection } from '../types/base.js'
import type { IBroadcastTransport } from '../types/channel.js'
import type { ClientId, DataMessage } from '@synnel/types'
import { createDataMessage } from '@synnel/lib'
import { BROADCAST_CHANNEL } from '../config/constants.js'

// ============================================================
// BROADCAST TRANSPORT CLASS
// ============================================================

/**
 * Broadcast Transport - sends messages to ALL connected clients
 *
 * This is a server-to-client only channel (one-way communication).
 * Unlike multicast channels, broadcast does not require subscription -
 * all connected clients receive broadcast messages.
 *
 * @template T The type of data broadcast
 *
 * @example
 * ```ts
 * import { BroadcastTransport } from '@synnel/server/channel'
 *
 * const broadcast = new BroadcastTransport(clientsMap)
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
export class BroadcastTransport<T = unknown> implements IBroadcastTransport<T> {
  /**
   * Channel name (always '__broadcast__')
   */
  public readonly name: '__broadcast__' = BROADCAST_CHANNEL

  /**
   * Map of all connected clients
   * This is a reference to the transport's connections Map
   */
  protected readonly clients: Map<ClientId, IClientConnection>

  /**
   * Create a new BroadcastTransport
   *
   * @param clients - Map of all connected clients
   *
   * @example
   * ```ts
   * const transport = new WebSocketServerTransport({ server: httpServer })
   * const broadcast = new BroadcastTransport(transport.connections)
   * ```
   */
  constructor(clients: Map<ClientId, IClientConnection>) {
    this.clients = clients
  }

  /**
   * Get the current subscriber count
   * For broadcast, this is the total number of connected clients
   */
  get subscriberCount(): number {
    return this.clients.size
  }

  // ============================================================
  // PUBLISH METHODS (implements IChannel<T>)
  // ============================================================

  /**
   * Publish data to connected clients
   *
   * Without options: sends to ALL connected clients
   * With options: filters recipients based on `to` and `exclude`
   *
   * @param data - The data to publish
   * @param options - Optional publish options for filtering recipients
   *
   * @example
   * ```ts
   * // Send to all connected clients
   * broadcast.publish('Hello everyone!')
   *
   * // Send to specific clients only
   * broadcast.publish('Private message', { to: ['client-1', 'client-2'] })
   *
   * // Send to all except specific clients
   * broadcast.publish('Hello', { exclude: ['client-3'] })
   *
   * // Combine to and exclude
   * broadcast.publish('Message', {
   *   to: ['client-1', 'client-2', 'client-3'],
   *   exclude: ['client-2']
   * }) // Only sends to client-1 and client-3
   * ```
   */
  publish(data: T, options?: IPublishOptions): void {
    const message = createDataMessage(this.name, data)

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
   *
   * @param message - The message to send
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
   *
   * @param message - The message to send
   * @param excludeIds - Client IDs to exclude
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
   *
   * @param message - The message to send
   * @param toIds - Client IDs to send to
   * @param excludeIds - Optional client IDs to exclude from the `to` list
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

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IChannel,
  IPublishOptions,
  IClientConnection,
} from '../types/base.js'

export type { IBroadcastTransport } from '../types/channel.js'
