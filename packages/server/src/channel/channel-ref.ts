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

export class ChannelRef<T = unknown>
  extends BaseChannel<T>
  implements IChannelTransport<T>
{
  private readonly middlewares: IMiddleware[] = []

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
    return this.handlers.addMessageHandler(
      this.name,
      handler as IMessageHandler<unknown>,
    )
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
    const handlers = this.handlers.getMessageHandlers(this.name)

    for (const handler of handlers) {
      try {
        await handler(data, client, message as any)
      } catch (error) {
        console.error(
          `Error in message handler for channel ${this.name}:`,
          error,
        )
      }
    }
  }

  onSubscribe(handler: ILifecycleHandler): () => void {
    return this.handlers.addSubscribeHandler(this.name, handler)
  }

  onUnsubscribe(handler: ILifecycleHandler): () => void {
    return this.handlers.addUnsubscribeHandler(this.name, handler)
  }

  async handleSubscribe(client: IClientConnection): Promise<void> {
    const handlers = this.handlers.getSubscribeHandlers(this.name)

    for (const handler of handlers) {
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
    const handlers = this.handlers.getUnsubscribeHandlers(this.name)

    for (const handler of handlers) {
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
