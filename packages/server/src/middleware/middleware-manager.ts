/**
 * Middleware Manager
 * Manages registration and execution of middleware functions.
 *
 * @module middleware/middleware-manager
 */

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

// ============================================================
// MIDDLEWARE CONTEXT CLASS
// ============================================================

/**
 * Middleware Context implementation
 * Provides context and control to middleware functions.
 *
 * @example
 * ```ts
 * const context = new MiddlewareContext({
 *   client: client,
 *   action: 'connect'
 * })
 * ```
 */
/**
 * Middleware Context implementation
 * Provides context and control to middleware functions.
 *
 * @template S - Type of the shared state object
 */
class MiddlewareContext<S = Record<string, any>>
  implements IMiddlewareContext<S> {
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

  /**
   * Reject the action with a reason
   * Calling this will prevent the action from completing
   *
   * @param reason - Human-readable reason for rejection
   * @throws MiddlewareRejectionError
   */
  private _reject(reason: string): void {
    this._rejected = true
    this._rejectionReason = reason
    throw new MiddlewareRejectionError(reason, this.action)
  }

  /**
   * Check if this context was rejected
   * Used internally by the middleware manager
   */
  private _isRejected(): boolean {
    return this._rejected
  }

  /**
   * Get the rejection reason
   * Used internally by the middleware manager
   */
  private _getRejectionReason(): string | undefined {
    return this._rejectionReason
  }
}

// ============================================================
// MIDDLEWARE MANAGER CLASS
// ============================================================

/**
 * Middleware Manager - manages and executes middleware functions
 *
 * Middleware functions are executed in an onion pattern (recursive composition).
 * Each middleware calls next() to pass control to the next layer.
 */
export class MiddlewareManager
  implements IMiddlewareManager, IMiddlewareContextFactory {
  /**
   * Registered middleware functions
   */
  protected readonly middlewares: IMiddleware[] = []

  // ============================================================
  // MIDDLEWARE REGISTRATION (implements IMiddlewareManager)
  // ============================================================

  /**
   * Register a middleware function
   */
  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware)
  }

  /**
   * Remove a middleware function
   */
  remove(middleware: IMiddleware): boolean {
    const index = this.middlewares.indexOf(middleware)
    if (index !== -1) {
      this.middlewares.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares.length = 0
  }

  /**
   * Get all registered middleware
   */
  getMiddlewares(): IMiddleware[] {
    return [...this.middlewares]
  }

  // ============================================================
  // MIDDLEWARE EXECUTION
  // ============================================================

  /**
   * Compose multiple middleware functions into a single execution function
   *
   * @param middlewares - Array of middleware functions
   * @returns A composed function that runs the onion
   */
  public compose(middlewares: IMiddleware[]): (context: IMiddlewareContext, next?: () => Promise<void>) => Promise<void> {
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
          if (error instanceof MiddlewareRejectionError || error instanceof MiddlewareExecutionError) {
            throw error
          }

          // Wrap unexpected errors
          const middlewareName = (fn as any).name || `middleware[${i}]`
          throw new MiddlewareExecutionError(
            context.action,
            middlewareName,
            error instanceof Error ? error : new Error(String(error))
          )
        }
      }

      return dispatch(0)
    }
  }

  /**
   * Execute middleware for a connection action
   */
  async executeConnection(
    client: IClientConnection,
    action: 'connect' | 'disconnect',
  ): Promise<void> {
    const context = this.createConnectionContext(client, action)
    await this.compose(this.middlewares)(context)
  }

  /**
   * Execute middleware for a message action
   */
  async executeMessage(client: IClientConnection, message: Message): Promise<void> {
    const context = this.createMessageContext(client, message)
    await this.compose(this.middlewares)(context)
  }

  /**
   * Execute middleware for a subscribe action
   */
  async executeSubscribe(
    client: IClientConnection,
    channel: ChannelName,
    finalHandler?: () => Promise<void>
  ): Promise<void> {
    const context = this.createSubscribeContext(client, channel)
    await this.compose(this.middlewares)(context, finalHandler)
  }

  /**
   * Execute middleware for an unsubscribe action
   */
  async executeUnsubscribe(
    client: IClientConnection,
    channel: ChannelName,
    finalHandler?: () => Promise<void>
  ): Promise<void> {
    const context = this.createUnsubscribeContext(client, channel)
    await this.compose(this.middlewares)(context, finalHandler)
  }

  /**
   * Execute a chain of middlewares with a context
   * Useful for internal manual triggers
   */
  async execute(
    context: IMiddlewareContext,
    middlewares: IMiddleware[] = this.middlewares,
    finalHandler?: () => Promise<void>
  ): Promise<void> {
    await this.compose(middlewares)(context, finalHandler)
  }

  // ============================================================
  // CONTEXT FACTORY (implements IMiddlewareContextFactory)
  // ============================================================

  /**
   * Create context for a connection action
   */
  createConnectionContext(
    client: IClientConnection,
    action: 'connect' | 'disconnect',
  ): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      action,
    })
  }

  /**
   * Create context for a message action
   */
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

  /**
   * Create context for a subscribe action
   */
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

  /**
   * Create context for an unsubscribe action
   */
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

  /**
   * Get the number of registered middleware
   */
  getCount(): number {
    return this.middlewares.length
  }

  /**
   * Check if any middleware is registered
   */
  hasMiddleware(): boolean {
    return this.middlewares.length > 0
  }
}
