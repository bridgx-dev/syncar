import type {
  IChannelTransport,
  IMessageHandler,
  ILifecycleHandler,
  IClientConnection,
  IPublishOptions,
  IMiddleware,
} from '../types'
import type { ChannelName, SubscriberId, ClientId } from '../types'
import type { DataMessage } from '../types/message'
import { BaseChannel } from './base.js'
import { ClientRegistry } from '../registry'

export interface MulticastChannelOptions {
  chunkSize?: number
}

export class MulticastChannel<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T> {
  private readonly middlewares: IMiddleware[] = []

  private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()
  private readonly subscribeHandlers: Set<ILifecycleHandler> = new Set()
  private readonly unsubscribeHandlers: Set<ILifecycleHandler> = new Set()

  constructor(config: {
    name: ChannelName
    registry: ClientRegistry
    options?: MulticastChannelOptions
  }) {
    super(config.name, config.registry, config.options?.chunkSize)
  }

  protected getTargetClients(_options?: IPublishOptions): ClientId[] {
    return Array.from(this.registry.getChannelSubscribers(this.name))
  }

  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware)
  }

  getMiddlewares(): IMiddleware[] {
    return [...this.middlewares]
  }

  get subscriberCount(): number {
    return this.registry.getChannelSubscribers(this.name).size
  }

  onMessage(handler: IMessageHandler<T>): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  subscribe(subscriber: SubscriberId): boolean {
    return this.registry.subscribe(subscriber, this.name)
  }

  unsubscribe(subscriber: SubscriberId): boolean {
    return this.registry.unsubscribe(subscriber, this.name)
  }

  async receive(
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
  ): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(data, client, message)
      } catch (error) {
        console.error(
          `Error in message handler for channel ${this.name}:`,
          error,
        )
      }
    }
  }

  onSubscribe(handler: ILifecycleHandler): () => void {
    this.subscribeHandlers.add(handler)
    return () => this.subscribeHandlers.delete(handler)
  }

  onUnsubscribe(handler: ILifecycleHandler): () => void {
    this.unsubscribeHandlers.add(handler)
    return () => this.unsubscribeHandlers.delete(handler)
  }

  async handleSubscribe(client: IClientConnection): Promise<void> {
    for (const handler of this.subscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(
          `Error in subscribe handler for channel ${this.name}:`,
          error,
        )
        // Re-throw to allow blocking subscription on handler error
        throw error
      }
    }
  }

  async handleUnsubscribe(client: IClientConnection): Promise<void> {
    for (const handler of this.unsubscribeHandlers) {
      try {
        await handler(client)
      } catch (error) {
        console.error(
          `Error in unsubscribe handler for channel ${this.name}:`,
          error,
        )
      }
    }
  }

  hasSubscriber(subscriber: SubscriberId): boolean {
    return this.registry.getChannelSubscribers(this.name).has(subscriber)
  }

  getSubscribers(): Set<SubscriberId> {
    // Return a copy to prevent external modification
    return new Set(this.registry.getChannelSubscribers(this.name))
  }

  isEmpty(): boolean {
    return this.registry.getChannelSubscribers(this.name).size === 0
  }
}
