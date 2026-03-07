import type {
  ClientId,
  IBroadcastTransport,
  IPublishOptions,
} from '../types'
import { BaseChannel } from './base'
import { BROADCAST_CHANNEL } from '../config'
import { ClientRegistry } from '../registry'

export class BroadcastChannel<T = unknown>
  extends BaseChannel<T, typeof BROADCAST_CHANNEL>
  implements IBroadcastTransport<T> {
  constructor(registry: ClientRegistry, chunkSize: number = 500) {
    super(BROADCAST_CHANNEL, registry, chunkSize)
  }

  protected getTargetClients(_options?: IPublishOptions): ClientId[] {
    return Array.from(this.registry.connections.keys())
  }

  get subscriberCount(): number {
    return this.registry.connections.size
  }

  isEmpty(): boolean {
    return this.registry.connections.size === 0
  }
}
