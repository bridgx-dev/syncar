/**
 * BroadcastChannel
 * Simple broadcast channel that sends to all connected clients.
 *
 * Unlike multicast channels, broadcast reaches every connected client
 * without requiring subscription.
 */

import type {
  ClientId,
  IBroadcastTransport,
  IPublishOptions,
  IClientRegistry,
} from '../types'
import { BaseChannel } from './base-channel'
import { BROADCAST_CHANNEL } from '../config'

/**
 * Broadcast Channel - sends messages to ALL connected clients
 */
export class BroadcastChannel<T = unknown>
  extends BaseChannel<T, typeof BROADCAST_CHANNEL>
  implements IBroadcastTransport<T> {
  constructor(registry: IClientRegistry, chunkSize: number = 500) {
    super(BROADCAST_CHANNEL, registry, chunkSize)
  }

  /**
   * Broadcast channels always have all current connections as targets
   */
  protected getTargetClients(_options?: IPublishOptions): ClientId[] {
    return Array.from(this.registry.connections.keys())
  }

  /**
   * Broadcast channels effectively have all clients as "subscribers"
   */
  get subscriberCount(): number {
    return this.registry.connections.size
  }

  /**
   * Broadcast channels are never empty if someone is connected
   */
  isEmpty(): boolean {
    return this.registry.connections.size === 0
  }
}
