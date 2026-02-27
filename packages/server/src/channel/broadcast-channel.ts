/**
 * BroadcastChannel
 * Simple broadcast channel that sends to all connected clients.
 *
 * Unlike multicast channels, broadcast reaches every connected client
 * without requiring subscription.
 */

import type {
  IClientConnection,
  SubscriberId,
} from '../types'
import type { IBroadcastTransport } from '../types'
import type { IPublishOptions } from '../types'
import { createDataMessage } from '../lib'

/**
 * Broadcast Channel - sends messages to ALL connected clients
 */
export class BroadcastChannel<T = unknown> implements IBroadcastTransport<T> {
  /** Channel name is always the broadcast channel */
  public readonly name = '__broadcast__' as const

  private readonly connections: Map<SubscriberId, IClientConnection>
  private readonly chunkSize: number

  constructor(
    connections: Map<SubscriberId, IClientConnection>,
    chunkSize: number = 500,
  ) {
    this.connections = connections
    this.chunkSize = chunkSize
  }

  /**
   * Broadcast channels always have 0 subscribers (they send to everyone)
   */
  get subscriberCount(): number {
    return 0
  }

  /**
   * Publish data to ALL connected clients
   */
  publish(data: T, options?: IPublishOptions): void {
    const clients = Array.from(this.connections.values())

    if (clients.length > this.chunkSize) {
      this.publishInChunks(data, clients, options)
    } else {
      this.publishToClients(data, clients, options)
    }
  }

  /**
   * Internal helper to publish to a set of clients synchronously
   */
  private publishToClients(
    data: T,
    clients: IClientConnection[],
    options?: IPublishOptions,
  ): void {
    const message = createDataMessage<T>(this.name, data)

    for (const client of clients) {
      // Apply filters
      if (options?.to && !options.to.includes(client.id)) continue
      if (options?.exclude && options.exclude.includes(client.id)) continue

      try {
        client.socket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Failed to send broadcast to ${client.id}:`, error)
      }
    }
  }

  /**
   * Publish data to clients in chunks using setImmediate to avoid blocking the event loop
   */
  private publishInChunks(
    data: T,
    clients: IClientConnection[],
    options?: IPublishOptions,
  ): void {
    let index = 0

    const nextChunk = () => {
      const chunk = clients.slice(index, index + this.chunkSize)
      if (chunk.length === 0) return

      this.publishToClients(data, chunk, options)
      index += this.chunkSize

      if (index < clients.length) {
        setImmediate(nextChunk)
      }
    }

    nextChunk()
  }

  isEmpty(): boolean {
    return true
  }
}
