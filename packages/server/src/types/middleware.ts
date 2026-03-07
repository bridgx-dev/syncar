/**
 * Middleware Types
 * Types for the middleware system that processes connections, messages, and actions.
 */

import type { IClientConnection } from './base'
import type { ChannelName } from './common'
import type { Message } from './message'

// ============================================================
// MIDDLEWARE ACTION TYPES
// ============================================================

/**
 * Middleware action types
 * Represents the type of action being processed by middleware.
 *
 * @example
 * ```ts
 * const handleMiddleware = async (context: IMiddlewareContext) => {
 *   switch (context.action) {
 *     case 'connect':
 *       console.log('New client connecting')
 *       break
 *     case 'message':
 *       console.log('Processing message')
 *       break
 *     case 'subscribe':
 *       console.log('Client subscribing to', context.channel)
 *       break
 *   }
 * }
 * ```
 */
export type IMiddlewareAction =
  | 'connect' // New client connection
  | 'disconnect' // Client disconnection
  | 'message' // Message received from client
  | 'subscribe' // Client subscribing to channel
  | 'unsubscribe' // Client unsubscribing from channel

// ============================================================
// MIDDLEWARE CONTEXT INTERFACE
// ============================================================

export type NextFunction = () => Promise<any>
export type Next = NextFunction

/**
 * Middleware context interface (Hono-style)
 * Provides context and control to middleware functions.
 *
 * @template S - Type of the shared state object
 */
export interface Context<S = Record<string, any>> {
  /**
   * Request-specific data
   */
  readonly req: {
    /** The client involved in this action */
    readonly client?: IClientConnection
    /** The message being processed */
    readonly message?: Message
    /** The channel name for channel-specific actions */
    readonly channel?: ChannelName
    /** The action being performed */
    readonly action: IMiddlewareAction
  }

  /**
   * The error object if an error occurred during execution
   */
  error?: Error

  /**
   * Whether the request/action has been finalized
   */
  finalized: boolean

  /**
   * The result/response object
   */
  res?: any

  /**
   * Shared state variables
   */
  readonly var: S

  /**
   * Get a variable from the state
   */
  get<K extends keyof S>(key: K): S[K]

  /**
   * Set a variable in the state
   */
  set<K extends keyof S>(key: K, value: S[K]): void

  /**
   * Reject the action with a reason
   *
   * @param reason - Human-readable reason for rejection
   * @throws MiddlewareRejectionError
   */
  reject(reason: string): never
}
// ============================================================
// MIDDLEWARE FUNCTION TYPE
// ============================================================

/**
 * Middleware function signature
 *
 * @template S - Type of the shared state object
 */
export type Middleware<S = any> = (
  c: Context<S>,
  next: NextFunction,
) => any | Promise<any>

// Alias for legacy compatibility
export type IMiddleware<S = any> = Middleware<S>
export type IMiddlewareContext<S = any> = Context<S>

// ============================================================
// MIDDLEWARE REJECTION ERROR INTERFACE
// ============================================================

/**
 * Middleware rejection error interface
 * Thrown when middleware rejects an action.
 *
 * @example
 * ```ts
 * try {
 *   await middleware.executeConnection(client, 'connect')
 * } catch (error) {
 *   if (error instanceof MiddlewareRejectionError) {
 *     console.log(`Action rejected: ${error.reason}`)
 *     console.log(`Action: ${error.action}`)
 *   }
 * }
 * ```
 */
export interface IMiddlewareRejectionError extends Error {
  /** The reason for rejection */
  reason: string

  /** The action that was rejected */
  action: string

  /** Error name */
  name: 'MiddlewareRejectionError'
}

// ============================================================
// MIDDLEWARE COMPOSITION UTILITIES
// ============================================================

/**
 * Middleware chain type
 * Readonly array of middleware functions.
 *
 * @example
 * ```ts
 * const chain: IMiddlewareChain = [
 *   authMiddleware,
 *   loggingMiddleware,
 *   rateLimitMiddleware
 * ]
 * ```
 */
export type IMiddlewareChain = ReadonlyArray<IMiddleware>

/**
 * Composed middleware type
 * Result of composing multiple middleware functions.
 *
 * @example
 * ```ts
 * // Type for a composed middleware
 * const composed: IComposedMiddleware = Object.assign(
 *   async (context: IMiddlewareContext) => {
 *     // middleware logic
 *   },
 *   {
 *     composed: true,
 *     middlewares: [middleware1, middleware2, middleware3]
 *   }
 * )
 *
 * // Access composed middlewares
 * composed.middlewares // IMiddlewareChain
 * composed.composed // true
 * ```
 */
export type IComposedMiddleware = (
  context: IMiddlewareContext,
) => Promise<Context> & {
  readonly composed: true
  readonly middlewares: IMiddlewareChain
}

/**
 * Action-specific middleware type
 * Middleware that only handles specific action types.
 *
 * @template T The specific action type(s)
 *
 * @example
 * ```ts
 * const connectOnly: IActionMiddleware<'connect'> = async (context) => {
 *   // context.action is typed as 'connect'
 *   if (!isValidClient(context.client)) {
 *     context.reject('Invalid client')
 *   }
 * }
 *
 * const messageOnly: IActionMiddleware<'message' | 'subscribe'> = async (context) => {
 *   // context.action is typed as 'message' | 'subscribe'
 *   console.log('Action:', context.action, 'Channel:', context.channel)
 * }
 * ```
 */
export type IActionMiddleware<T extends IMiddlewareAction> = (
  context: IMiddlewareContext & { action: T },
) => any | Promise<any>

