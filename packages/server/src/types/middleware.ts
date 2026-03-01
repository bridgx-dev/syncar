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

/**
 * Next function type
 * Called by middleware to pass control to the next layer in the onion.
 * Returns a promise that resolves when all downstream layers have finished.
 */
export type NextFunction = () => Promise<void>

/**
 * Middleware context interface
 * Provides context and control to middleware functions.
 *
 * Middleware functions receive this context and can inspect
 * the action, client, message, and channel. They can also
 * reject actions by calling the reject() function.
 *
 * @template S - Type of the shared state object
 *
 * @example
 * ```ts
 * const loggingMiddleware: IMiddleware = async ({ client, action }, next) => {
 *   console.log(`[${action}] Client: ${client?.id}`)
 *   await next() // Pass to next middleware
 * }
 *
 * const authMiddleware: IMiddleware<{ user: User }> = async (context, next) => {
 *   if (context.action === 'connect') {
 *     const user = await validate(context.token)
 *     context.state.user = user // Shared state!
 *   }
 *   await next()
 * }
 * ```
 */
export interface IMiddlewareContext<S = Record<string, any>> {
  /**
   * Shared state between middleware layers
   */
  readonly state: S

  /**
   * The client involved in this action
   * Undefined for server-level middleware before connection
   */
  client?: IClientConnection

  /**
   * The message being processed
   * Undefined for non-message actions (connect, disconnect, subscribe, unsubscribe)
   */
  message?: Message

  /**
   * The channel name for channel-specific actions
   * Undefined for non-channel actions
   */
  channel?: ChannelName

  /**
   * The action being performed
   */
  action: IMiddlewareAction

  /**
   * Reject the action with a reason
   * Calling this will prevent the action from completing and
   * send an error to the client if applicable.
   *
   * @param reason - Human-readable reason for rejection
   * @throws MiddlewareRejectionError
   *
   * @example
   * ```ts
   * if (!isAuthorized(client)) {
   *   context.reject('User not authorized for this action')
   * }
   * ```
   */
  reject(reason: string): void
}

// ============================================================
// MIDDLEWARE FUNCTION TYPE
// ============================================================

/**
 * Middleware function signature
 *
 * Middleware functions are executed in sequence (onion pattern) for each action.
 * They receive a context and a next() function to call the next layer.
 *
 * @template S - Type of the shared state object
 */
export type IMiddleware<S = any> = (
  context: IMiddlewareContext<S>,
  next: NextFunction,
) => void | Promise<void>

// ============================================================
// MIDDLEWARE MANAGER INTERFACE
// ============================================================

/**
 * Middleware manager interface
 * Manages registration and execution of middleware functions.
 *
 * @example
 * ```ts
 * class MyMiddlewareManager implements IMiddlewareManager {
 *   use(middleware: IMiddleware): void { ... }
 *   remove(middleware: IMiddleware): boolean { ... }
 *   clear(): void { ... }
 *   executeConnection(client, action): Promise<void> { ... }
 *   executeMessage(client, message): Promise<void> { ... }
 *   executeSubscribe(client, channel): Promise<void> { ... }
 *   executeUnsubscribe(client, channel): Promise<void> { ... }
 * }
 * ```
 */
export interface IMiddlewareManager extends IMiddlewareContextFactory {
  /**
   * Register a middleware function
   *
   * @param middleware - The middleware to register
   */
  use(middleware: IMiddleware): void

  /**
   * Remove a middleware function
   *
   * @param middleware - The middleware to remove
   * @returns true if removed, false if not found
   */
  remove(middleware: IMiddleware): boolean

  /**
   * Clear all middleware
   */
  clear(): void

  /**
   * Get all registered global middleware
   *
   * @returns Array of global middleware
   */
  getMiddlewares(): IMiddleware[]

  /**
   * Execute a custom composed pipeline of middleware
   *
   * @param context - The middleware context
   * @param middlewares - The pipeline to execute
   * @param kernel - The final function to execute at the center of the onion
   */
  execute(
    context: IMiddlewareContext,
    middlewares: IMiddleware[],
    kernel: () => Promise<void>,
  ): Promise<void>

  /**
   * Execute middleware for a connection action
   *
   * @param client - The client
   * @param action - The action type ('connect' | 'disconnect')
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeConnection(
    client: IClientConnection,
    action: 'connect' | 'disconnect',
  ): Promise<void>

  /**
   * Execute middleware for a message action
   *
   * @param client - The client who sent the message
   * @param message - The message
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeMessage(client: IClientConnection, message: Message): Promise<void>

  /**
   * Execute middleware for a subscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeSubscribe(client: IClientConnection, channel: ChannelName): Promise<void>

  /**
   * Execute middleware for an unsubscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeUnsubscribe(client: IClientConnection, channel: ChannelName): Promise<void>
}

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
// MIDDLEWARE CONTEXT FACTORY INTERFACE
// ============================================================

/**
 * Middleware context factory interface
 * Creates middleware context objects.
 *
 * Implementations can customize context creation to add
 * additional properties or behavior.
 */
export interface IMiddlewareContextFactory {
  /**
   * Create context for a connection action
   *
   * @param client - The client
   * @param action - The action type
   * @returns Middleware context
   */
  createConnectionContext(
    client: IClientConnection,
    action: 'connect' | 'disconnect',
  ): IMiddlewareContext

  /**
   * Create context for a message action
   *
   * @param client - The client
   * @param message - The message
   * @returns Middleware context
   */
  createMessageContext(
    client: IClientConnection,
    message: Message,
  ): IMiddlewareContext

  /**
   * Create context for a subscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @returns Middleware context
   */
  createSubscribeContext(
    client: IClientConnection,
    channel: ChannelName,
  ): IMiddlewareContext

  /**
   * Create context for an unsubscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @returns Middleware context
   */
  createUnsubscribeContext(
    client: IClientConnection,
    channel: ChannelName,
  ): IMiddlewareContext
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
) => Promise<void> & {
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
) => void | Promise<void>

// ============================================================
// MIDDLEWARE MANAGER CLASS
// ============================================================

/**
 * Middleware Manager - manages and executes middleware functions
 *
 * Middleware functions are executed in an onion pattern (recursive composition).
 * Each middleware calls next() to pass control to the next layer.
 *
 * @example
 * ```ts
 * const manager = new MiddlewareManager()
 *
 * // Register middleware
 * manager.use(async (context, next) => {
 *   console.log('Before')
 *   await next()
 *   console.log('After')
 * })
 *
 * // Execute middleware
 * await manager.executeConnection(client, 'connect')
 * ```
 */
export declare class MiddlewareManager implements IMiddlewareManager, IMiddlewareContextFactory {
  protected readonly middlewares: IMiddleware[]

  /**
   * Compose multiple middleware functions into a single execution function
   *
   * @param middlewares - Array of middleware functions
   * @returns A composed function that runs the onion
   *
   * @remarks
   * The compose function creates an onion-like execution pattern where
   * each middleware wraps the next. Middleware can modify the context,
   * reject the action, or pass control to the next layer.
   */
  compose(
    middlewares: IMiddleware[]
  ): (context: IMiddlewareContext, next?: () => Promise<void>) => Promise<void>

  /**
   * Register a middleware function
   *
   * @param middleware - Middleware function to register
   *
   * @example
   * ```ts
   * manager.use(async (context, next) => {
   *   console.log('Processing:', context.action)
   *   await next()
   * })
   * ```
   */
  use(middleware: IMiddleware): void

  /**
   * Remove a middleware function
   *
   * @param middleware - Middleware function to remove
   * @returns true if removed, false if not found
   */
  remove(middleware: IMiddleware): boolean

  /**
   * Clear all middleware
   *
   * @example
   * ```ts
   * manager.clear()
   * ```
   */
  clear(): void

  /**
   * Get all registered middleware
   *
   * @returns Array of registered middleware functions
   */
  getMiddlewares(): IMiddleware[]

  /**
   * Execute middleware for a connection action
   *
   * @param client - The client connection
   * @param action - The connection action ('connect' | 'disconnect')
   *
   * @throws {MiddlewareRejectionError} If middleware rejects the action
   * @throws {MiddlewareExecutionError} If middleware throws an unexpected error
   */
  executeConnection(client: IClientConnection, action: 'connect' | 'disconnect'): Promise<void>

  /**
   * Execute middleware for a message action
   *
   * @param client - The client connection
   * @param message - The message being processed
   *
   * @throws {MiddlewareRejectionError} If middleware rejects the action
   * @throws {MiddlewareExecutionError} If middleware throws an unexpected error
   */
  executeMessage(client: IClientConnection, message: Message): Promise<void>

  /**
   * Execute middleware for a subscribe action
   *
   * @param client - The client connection
   * @param channel - The channel name
   * @param finalHandler - Optional final handler to execute after middleware
   *
   * @throws {MiddlewareRejectionError} If middleware rejects the action
   * @throws {MiddlewareExecutionError} If middleware throws an unexpected error
   */
  executeSubscribe(
    client: IClientConnection,
    channel: ChannelName,
    finalHandler?: () => Promise<void>
  ): Promise<void>

  /**
   * Execute middleware for an unsubscribe action
   *
   * @param client - The client connection
   * @param channel - The channel name
   * @param finalHandler - Optional final handler to execute after middleware
   *
   * @throws {MiddlewareRejectionError} If middleware rejects the action
   * @throws {MiddlewareExecutionError} If middleware throws an unexpected error
   */
  executeUnsubscribe(
    client: IClientConnection,
    channel: ChannelName,
    finalHandler?: () => Promise<void>
  ): Promise<void>

  /**
   * Execute a chain of middlewares with a context
   * Useful for internal manual triggers
   *
   * @param context - The middleware context
   * @param middlewares - Array of middleware to execute (defaults to all registered)
   * @param finalHandler - Optional final handler to execute after middleware
   *
   * @throws {MiddlewareRejectionError} If middleware rejects the action
   * @throws {MiddlewareExecutionError} If middleware throws an unexpected error
   */
  execute(
    context: IMiddlewareContext,
    middlewares?: IMiddleware[],
    finalHandler?: () => Promise<void>
  ): Promise<void>

  /**
   * Create context for a connection action
   *
   * @param client - The client connection
   * @param action - The connection action
   * @returns Middleware context for connection actions
   */
  createConnectionContext(
    client: IClientConnection,
    action: 'connect' | 'disconnect'
  ): IMiddlewareContext

  /**
   * Create context for a message action
   *
   * @param client - The client connection
   * @param message - The message being processed
   * @returns Middleware context for message actions
   */
  createMessageContext(
    client: IClientConnection,
    message: Message
  ): IMiddlewareContext

  /**
   * Create context for a subscribe action
   *
   * @param client - The client connection
   * @param channel - The channel name
   * @returns Middleware context for subscribe actions
   */
  createSubscribeContext(
    client: IClientConnection,
    channel: ChannelName
  ): IMiddlewareContext

  /**
   * Create context for an unsubscribe action
   *
   * @param client - The client connection
   * @param channel - The channel name
   * @returns Middleware context for unsubscribe actions
   */
  createUnsubscribeContext(
    client: IClientConnection,
    channel: ChannelName
  ): IMiddlewareContext

  /**
   * Get the number of registered middleware
   *
   * @returns Count of registered middleware functions
   */
  getCount(): number

  /**
   * Check if any middleware is registered
   *
   * @returns true if at least one middleware is registered
   */
  hasMiddleware(): boolean
}
