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
import type { DataMessage } from '../types/message'
import { BaseChannel } from './base-channel.js'

export class ChannelRef<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T> {
  private readonly middlewares: IMiddleware[] = []

  private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()
  private readonly subscribeHandlers: Set<ILifecycleHandler> = new Set()
  private readonly unsubscribeHandlers: Set<ILifecycleHandler> = new Set()

  constructor(
    name: ChannelName,
    registry: IClientRegistry,
    private readonly _getSubscribers: () => Set<SubscriberId>,
    private readonly subscribeFn: (clientId: SubscriberId) => boolean,
    private readonly unsubscribeFn: (clientId: SubscriberId) => boolean,
    chunkSize: number = 500,
  ) {
    super(name, registry, chunkSize)
  }

  protected getTargetClients(_options?: IPublishOptions): ClientId[] {
    return Array.from(this._getSubscribers())
  }

  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware)
  }

  getMiddlewares(): IMiddleware[] {
    return [...this.middlewares]
  }

  get subscriberCount(): number {
    return this._getSubscribers().size
  }

  onMessage(handler: IMessageHandler<T>): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  subscribe(subscriber: SubscriberId): boolean {
    return this.subscribeFn(subscriber)
  }

  unsubscribe(subscriber: SubscriberId): boolean {
    return this.unsubscribeFn(subscriber)
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
    return this._getSubscribers().has(subscriber)
  }

  getSubscribers(): Set<SubscriberId> {
    // Return a copy to prevent external modification
    return new Set(this._getSubscribers())
  }

  isEmpty(): boolean {
    return this._getSubscribers().size === 0
  }
}
