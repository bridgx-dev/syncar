/**
 * Middleware Types
 * Types for the middleware system that processes connections, messages, and actions.
 */

import type { IServerClient } from './client'
import type { ChannelName, Message } from '@synnel/types'

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
 * Middleware context interface
 * Provides context and control to middleware functions.
 *
 * Middleware functions receive this context and can inspect
 * the action, client, message, and channel. They can also
 * reject actions by calling the reject() function.
 *
 * @example
 * ```ts
 * const loggingMiddleware: IMiddleware = async ({ client, action }) => {
 *   console.log(`[${action}] Client: ${client?.id}`)
 * }
 *
 * const authMiddleware: IMiddleware = async (context) => {
 *   if (context.action === 'connect') {
 *     // Validate connection and reject if needed
 *     if (!isValidConnection(context.client)) {
 *       context.reject('Connection not allowed')
 *     }
 *   }
 * }
 * ```
 */
export interface IMiddlewareContext {
  /**
   * The client involved in this action
   * Undefined for server-level middleware before connection
   */
  client?: IServerClient

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
 * Middleware functions are executed in sequence for each action.
 * They can inspect the context and reject actions if needed.
 *
 * @example
 * ```ts
 * // Simple logging middleware
 * const loggingMiddleware: IMiddleware = async (context) => {
 *   console.log(`[${context.action}] Client: ${context.client?.id}`)
 * }
 *
 * // Authentication middleware with rejection
 * const authMiddleware: IMiddleware = async (context) => {
 *   if (context.action === 'connect') {
 *     if (!isValidConnection(context.client)) {
 *       context.reject('Connection not allowed')
 *     }
 *   }
 * }
 *
 * // Rate limiting middleware
 * const rateLimitMiddleware: IMiddleware = async (context) => {
 *   if (context.action === 'message' && context.client) {
 *     const count = messageCounts.get(context.client.id) ?? 0
 *     if (count > 100) {
 *       context.reject('Rate limit exceeded')
 *     }
 *   }
 * }
 * ```
 */
export type IMiddleware = (context: IMiddlewareContext) => void | Promise<void>

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
export interface IMiddlewareManager {
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
   * Execute middleware for a connection action
   *
   * @param client - The client
   * @param action - The action type ('connect' | 'disconnect')
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeConnection(
    client: IServerClient,
    action: 'connect' | 'disconnect',
  ): Promise<void>

  /**
   * Execute middleware for a message action
   *
   * @param client - The client who sent the message
   * @param message - The message
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeMessage(client: IServerClient, message: Message): Promise<void>

  /**
   * Execute middleware for a subscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeSubscribe(client: IServerClient, channel: ChannelName): Promise<void>

  /**
   * Execute middleware for an unsubscribe action
   *
   * @param client - The client
   * @param channel - The channel name
   * @throws MiddlewareRejectionError if any middleware rejects
   */
  executeUnsubscribe(client: IServerClient, channel: ChannelName): Promise<void>
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
    client: IServerClient,
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
    client: IServerClient,
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
    client: IServerClient,
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
    client: IServerClient,
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
