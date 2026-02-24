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
} from '../types/middleware.js'
import type { IServerClient } from '../types/client.js'
import type { ChannelName, Message } from '@synnel/types'
import { MiddlewareRejectionError, MiddlewareExecutionError } from '../errors/middleware.js'

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
 *   client: serverClient,
 *   action: 'connect'
 * })
 * ```
 */
class MiddlewareContext implements IMiddlewareContext {
  public readonly client?: IServerClient
  public readonly message?: Message
  public readonly channel?: ChannelName
  public readonly action: IMiddlewareAction
  private _rejected = false
  private _rejectionReason?: string

  constructor(data: {
    client?: IServerClient
    message?: Message
    channel?: ChannelName
    action: IMiddlewareAction
  }) {
    this.client = data.client
    this.message = data.message
    this.channel = data.channel
    this.action = data.action
  }

  /**
   * Reject the action with a reason
   * Calling this will prevent the action from completing
   *
   * @param reason - Human-readable reason for rejection
   * @throws MiddlewareRejectionError
   *
   * @example
   * ```ts
   * context.reject('User not authorized')
   * ```
   */
  reject(reason: string): void {
    this._rejected = true
    this._rejectionReason = reason
    throw new MiddlewareRejectionError(reason, this.action)
  }

  /**
   * Check if this context was rejected
   * Used internally by the middleware manager
   */
  isRejected(): boolean {
    return this._rejected
  }

  /**
   * Get the rejection reason
   * Used internally by the middleware manager
   */
  getRejectionReason(): string | undefined {
    return this._rejectionReason
  }
}

// ============================================================
// MIDDLEWARE MANAGER CLASS
// ============================================================

/**
 * Middleware Manager - manages and executes middleware functions
 *
 * Middleware functions are executed in sequence for each action.
 * They can inspect the context and reject actions if needed.
 *
 * @example
 * ```ts
 * import { MiddlewareManager } from '@synnel/server/middleware'
 *
 * const manager = new MiddlewareManager()
 *
 * // Add middleware
 * manager.use(async ({ client, action }) => {
 *   console.log(`[${action}] Client: ${client.id}`)
 * })
 *
 * // Execute middleware
 * await manager.executeConnection(client, 'connect')
 * ```
 */
export class MiddlewareManager implements IMiddlewareManager, IMiddlewareContextFactory {
  /**
   * Registered middleware functions
   * Stored in an array to maintain execution order
   */
  protected readonly middlewares: IMiddleware[] = []

  // ============================================================
  // MIDDLEWARE REGISTRATION (implements IMiddlewareManager)
  // ============================================================

  /**
   * Register a middleware function
   *
   * Middleware are executed in the order they are registered.
   *
   * @param middleware - The middleware to register
   *
   * @example
   * ```ts
   * manager.use(async ({ client, action }) => {
   *   console.log(`[${action}] Client: ${client.id}`)
   * })
   * ```
   */
  use(middleware: IMiddleware): void {
    this.middlewares.push(middleware)
  }

  /**
   * Remove a middleware function
   *
   * @param middleware - The middleware to remove
   * @returns true if removed, false if not found
   *
   * @example
   * ```ts
   * const removed = manager.remove(loggingMiddleware)
   * ```
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
   *
   * @example
   * ```ts
   * manager.clear()
   * ```
   */
  clear(): void {
    this.middlewares.length = 0
  }

  // ============================================================
  // MIDDLEWARE EXECUTION (implements IMiddlewareManager)
  // ============================================================

  /**
   * Execute middleware for a connection action
   *
   * @param client - The client
   * @param action - The action type ('connect' | 'disconnect')
   * @throws MiddlewareRejectionError if any middleware rejects
   * @throws MiddlewareExecutionError if any middleware throws unexpectedly
   *
   * @example
   * ```ts
   * try {
   *   await manager.executeConnection(client, 'connect')
   * } catch (error) {
   *   if (error instanceof MiddlewareRejectionError) {
   *     console.log(`Connection rejected: ${error.reason}`)
   *   }
   * }
   * ```
   */
  async executeConnection(client: IServerClient, action: 'connect' | 'disconnect'): Promise<void> {
    const context = this.createConnectionContext(client, action)
    await this.executeMiddlewares(context, action)
  }

  /**
   * Execute middleware for a message action
   *
   * @param client - The client who sent the message
   * @param message - The message
   * @throws MiddlewareRejectionError if any middleware rejects
   * @throws MiddlewareExecutionError if any middleware throws unexpectedly
   *
   * @example
   * ```ts
   * try {
   *   await manager.executeMessage(client, message)
   * } catch (error) {
   *   if (error instanceof MiddlewareRejectionError) {
   *     console.log(`Message rejected: ${error.reason}`)
   *   }
   * }
   * ```
   */
  async executeMessage(client: IServerClient, message: Message): Promise<void> {
    const context = this.createMessageContext(client, message)
    await this.executeMiddlewares(context, 'message')
  }

  /**
   * Execute middleware for a subscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @throws MiddlewareRejectionError if any middleware rejects
   * @throws MiddlewareExecutionError if any middleware throws unexpectedly
   *
   * @example
   * ```ts
   * try {
   *   await manager.executeSubscribe(client, 'chat')
   * } catch (error) {
   *   if (error instanceof MiddlewareRejectionError) {
   *     console.log(`Subscription rejected: ${error.reason}`)
   *   }
   * }
   * ```
   */
  async executeSubscribe(client: IServerClient, channel: ChannelName): Promise<void> {
    const context = this.createSubscribeContext(client, channel)
    await this.executeMiddlewares(context, 'subscribe')
  }

  /**
   * Execute middleware for an unsubscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @throws MiddlewareRejectionError if any middleware rejects
   * @throws MiddlewareExecutionError if any middleware throws unexpectedly
   *
   * @example
   * ```ts
   * try {
   *   await manager.executeUnsubscribe(client, 'chat')
   * } catch (error) {
   *   if (error instanceof MiddlewareRejectionError) {
   *     console.log(`Unsubscribe rejected: ${error.reason}`)
   *   }
   * }
   * ```
   */
  async executeUnsubscribe(client: IServerClient, channel: ChannelName): Promise<void> {
    const context = this.createUnsubscribeContext(client, channel)
    await this.executeMiddlewares(context, 'unsubscribe')
  }

  // ============================================================
  // CONTEXT FACTORY (implements IMiddlewareContextFactory)
  // ============================================================

  /**
   * Create context for a connection action
   *
   * @param client - The client
   * @param action - The action type
   * @returns Middleware context
   */
  createConnectionContext(
    client: IServerClient,
    action: 'connect' | 'disconnect',
  ): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      action,
    })
  }

  /**
   * Create context for a message action
   *
   * @param client - The client
   * @param message - The message
   * @returns Middleware context
   */
  createMessageContext(client: IServerClient, message: Message): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      message,
      action: 'message',
    })
  }

  /**
   * Create context for a subscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @returns Middleware context
   */
  createSubscribeContext(client: IServerClient, channel: ChannelName): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      channel,
      action: 'subscribe',
    })
  }

  /**
   * Create context for an unsubscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @returns Middleware context
   */
  createUnsubscribeContext(client: IServerClient, channel: ChannelName): IMiddlewareContext {
    return new MiddlewareContext({
      client,
      channel,
      action: 'unsubscribe',
    })
  }

  // ============================================================
  // INTERNAL EXECUTION METHOD
  // ============================================================

  /**
   * Execute all middleware functions in sequence
   *
   * @param context - The middleware context
   * @param action - The action being processed
   * @throws MiddlewareRejectionError if any middleware rejects
   * @throws MiddlewareExecutionError if any middleware throws unexpectedly
   */
  protected async executeMiddlewares(context: IMiddlewareContext, action: string): Promise<void> {
    for (let i = 0; i < this.middlewares.length; i++) {
      const middleware = this.middlewares[i]!
      const middlewareName = (middleware as { name?: string }).name || `middleware[${i}]`

      try {
        await middleware(context)
      } catch (error) {
        // If it's a MiddlewareRejectionError, re-throw it
        if (error instanceof MiddlewareRejectionError) {
          throw error
        }

        // Wrap other errors in MiddlewareExecutionError
        if (error instanceof Error) {
          throw new MiddlewareExecutionError(action, middlewareName, error)
        }

        // Wrap non-Error thrown values
        throw new MiddlewareExecutionError(
          action,
          middlewareName,
          new Error(String(error)),
        )
      }
    }
  }

  /**
   * Get the number of registered middleware
   *
   * @returns Middleware count
   *
   * @example
   * ```ts
   * console.log(`Registered middleware: ${manager.getCount()}`)
   * ```
   */
  getCount(): number {
    return this.middlewares.length
  }

  /**
   * Check if any middleware is registered
   *
   * @returns true if at least one middleware is registered
   *
   * @example
   * ```ts
   * if (manager.hasMiddleware()) {
   *   console.log('Middleware is active')
   * }
   * ```
   */
  hasMiddleware(): boolean {
    return this.middlewares.length > 0
  }
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IMiddleware,
  IMiddlewareContext,
  IMiddlewareManager,
  IMiddlewareAction,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
  IMiddlewareContextFactory,
} from '../types/middleware.js'

export type { IServerClient } from '../types/client.js'

export type { ChannelName, Message } from '@synnel/types'
