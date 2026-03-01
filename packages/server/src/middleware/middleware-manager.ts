import type {
  IMiddleware,
  IMiddlewareContext,
  IMiddlewareManager,
  IMiddlewareContextFactory,
  IMiddlewareAction,
  IClientConnection,
  ChannelName,
  Message,
} from '../types'
import { MiddlewareRejectionError, MiddlewareExecutionError } from '../errors'

class MiddlewareContext<
  S = Record<string, any>,
> implements IMiddlewareContext<S> {
  public readonly state: S = {} as S
  public readonly client?: IClientConnection
  public readonly message?: Message
  public readonly channel?: ChannelName
  public readonly action: IMiddlewareAction
  private _rejected = false
  private _rejectionReason?: string

  // Bind methods to preserve `this` when destructured
  public readonly reject: (reason: string) => void
  public readonly isRejected: () => boolean
  public readonly getRejectionReason: () => string | undefined

  constructor(data: {
    client?: IClientConnection
    message?: Message
    channel?: ChannelName
    action: IMiddlewareAction
  }) {
    this.client = data.client
    this.message = data.message
    this.channel = data.channel
    this.action = data.action

    // Bind methods to preserve `this`
    this.reject = this._reject.bind(this)
    this.isRejected = this._isRejected.bind(this)
    this.getRejectionReason = this._getRejectionReason.bind(this)
  }

  private _reject(reason: string): void {
    this._rejected = true
    this._rejectionReason = reason
    throw new MiddlewareRejectionError(reason, this.action)
  }

  private _isRejected(): boolean {
    return this._rejected
  }

  private _getRejectionReason(): string | undefined {
    return this._rejectionReason
  }
}

export class MiddlewareManager
  implements IMiddlewareManager, IMiddlewareContextFactory
{
  protected readonly middlewares: IMiddleware[] = []

  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware)
  }

  remove(middleware: IMiddleware): boolean {
    const index = this.middlewares.indexOf(middleware)
    if (index !== -1) {
      this.middlewares.splice(index, 1)
      return true
    }
    return false
  }

  clear(): void {
    this.middlewares.length = 0
  }

  getMiddlewares(): IMiddleware[] {
    return [...this.middlewares]
  }

  public compose(
    middlewares: IMiddleware[],
  ): (
    context: IMiddlewareContext,
    next?: () => Promise<void>,
  ) => Promise<void> {
    return async (context, next) => {
      let index = -1

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times')
        }
        index = i
        let fn = middlewares[i]
        if (i === middlewares.length) {
          fn = next as any
        }
        if (!fn) return

        try {
          await fn(context, dispatch.bind(null, i + 1))
        } catch (error) {
          // If it's a rejection or already an execution error, re-throw
          if (
            error instanceof MiddlewareRejectionError ||
            error instanceof MiddlewareExecutionError
          ) {
            throw error
          }

          // Wrap unexpected errors
          const middlewareName = (fn as any).name || `middleware[${i}]`
          throw new MiddlewareExecutionError(
            context.action,
            middlewareName,
            error instanceof Error ? error : new Error(String(error)),
          )
        }
      }

      return dispatch(0)
    }
  }

  async executeConnection(
    client: IClientConnection,
    action: 'connect' | 'disconnect',
  ): Promise<void> {
    const context = this.createConnectionContext(client, action)
    await this.compose(this.middlewares)(context)
  }

  async executeMessage(
    client: IClientConnection,
    message: Message,
  ): Promise<void> {
    const context = this.createMessageContext(client, message)
    await this.compose(this.middlewares)(context)
  }

  async executeSubscribe(
    client: IClientConnection,
    channel: ChannelName,
    finalHandler?: () => Promise<void>,
  ): Promise<void> {
    const context = this.createSubscribeContext(client, channel)
    await this.compose(this.middlewares)(context, finalHandler)
  }

  async executeUnsubscribe(
    client: IClientConnection,
    channel: ChannelName,
    finalHandler?: () => Promise<void>,
  ): Promise<void> {
    const context = this.createUnsubscribeContext(client, channel)
    await this.compose(this.middlewares)(context, finalHandler)
  }

  async execute(
    context: IMiddlewareContext,
    middlewares: IMiddleware[] = this.middlewares,
    finalHandler?: () => Promise<void>,
  ): Promise<void> {
    await this.compose(middlewares)(context, finalHandler)
  }

  createConnectionContext(
    client: IClientConnection,
    action: 'connect' | 'disconnect',
  ): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      action,
    })
  }

  createMessageContext(
    client: IClientConnection,
    message: Message,
  ): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      message,
      action: 'message',
    })
  }

  createSubscribeContext(
    client: IClientConnection,
    channel: ChannelName,
  ): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      channel,
      action: 'subscribe',
    })
  }

  createUnsubscribeContext(
    client: IClientConnection,
    channel: ChannelName,
  ): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      channel,
      action: 'unsubscribe',
    })
  }

  getCount(): number {
    return this.middlewares.length
  }

  hasMiddleware(): boolean {
    return this.middlewares.length > 0
  }
}
