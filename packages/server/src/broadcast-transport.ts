/**
 * Broadcast Transport
 * Handles broadcasting messages to all connected clients
 */

import type {
  BroadcastTransport as IBroadcastTransport,
  ServerClient,
} from './types.js'
import type { DataMessage, Message } from '@synnel/types'
import { createDataMessage } from '@synnel/lib'
import type { ClientRegistry } from './client-registry.js'

/**
 * Broadcast channel name (special reserved channel)
 */
const BROADCAST_CHANNEL = '__broadcast__'

/**
 * Broadcast Transport Implementation
 */
export class BroadcastTransportImpl<
  T = unknown,
> implements IBroadcastTransport<T> {
  private messageHandlers: Set<
    (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>
  > = new Set()

  constructor(private registry: ClientRegistry) {}

  /**
   * Send data to all connected clients
   */
  async send(data: T): Promise<void> {
    const message = createDataMessage(BROADCAST_CHANNEL, data)
    await this._sendToAll(message)
  }

  /**
   * Send data to all clients except the sender
   */
  async sendExcept(data: T, excludeClientId: string): Promise<void> {
    const message = createDataMessage(BROADCAST_CHANNEL, data)
    await this._sendToAll(message, excludeClientId)
  }

  /**
   * Register a handler for incoming broadcast messages
   */
  onMessage(
    handler: (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>,
  ): () => void {
    this.messageHandlers.add(handler as any)
    return () => {
      this.messageHandlers.delete(handler as any)
    }
  }

  /**
   * Handle an incoming broadcast message
   * Called by SynnelServer when a broadcast message is received
   */
  async handleMessage(
    data: T,
    client: ServerClient,
    message: DataMessage<T>,
  ): Promise<void> {
    // Call message handlers
    for (const handler of this.messageHandlers) {
      try {
        await handler(data, client, message)
      } catch (error) {
        console.error('Error in broadcast message handler:', error)
      }
    }
  }

  /**
   * Internal: Send message to all clients
   */
  private async _sendToAll(
    message: Message,
    excludeClientId?: string,
  ): Promise<void> {
    const clients = this.registry.getAll()
    const promises: Promise<void>[] = []

    for (const client of clients) {
      if (excludeClientId && client.id === excludeClientId) {
        continue
      }

      promises.push(
        (async () => {
          try {
            await client.send(message)
          } catch (error) {
            console.error(
              `Failed to send broadcast to client ${client.id}:`,
              error,
            )
          }
        })(),
      )
    }

    await Promise.all(promises)
  }
}
