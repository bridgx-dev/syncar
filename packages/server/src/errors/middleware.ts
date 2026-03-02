/**
 * Middleware Error Classes
 * Custom error classes for middleware-related errors.
 *
 * @module errors/middleware
 */

import type { IMiddlewareRejectionError, IMiddlewareAction } from '../types'

// ============================================================
// MIDDLEWARE REJECTION ERROR
// ============================================================

/**
 * Middleware rejection error
 * Thrown when middleware rejects an action using the `reject()` function.
 *
 * This error implements the IMiddlewareRejectionError interface and is used
 * to signal that a middleware has rejected a connection, message, subscribe,
 * or unsubscribe action.
 *
 * @example
 * ```ts
 * import { MiddlewareRejectionError } from '@synnel/server/errors'
 *
 * const authMiddleware: IMiddleware = async ({ client, reject }) => {
 *   if (!isAuthenticated(client)) {
 *     reject('Authentication failed')
 *     // This throws MiddlewareRejectionError internally
 *   }
 * }
 *
 * try {
 *   await middleware.executeConnection(client, 'connect')
 * } catch (error) {
 *   if (error instanceof MiddlewareRejectionError) {
 *     console.log(`Rejected: ${error.reason}`)
 *     console.log(`Action: ${error.action}`)
 *   }
 * }
 * ```
 */
export class MiddlewareRejectionError
  extends Error
  implements IMiddlewareRejectionError
{
  /**
   * The reason for rejection
   * Human-readable explanation of why the action was rejected
   */
  public readonly reason: string

  /**
   * The action that was rejected
   * The type of action that was being processed when rejected
   */
  public readonly action: string

  /**
   * Error name (fixed value for interface compliance)
   */
  public override readonly name = 'MiddlewareRejectionError'

  /**
   * Optional error code for programmatic handling
   */
  public readonly code?: string

  /**
   * Additional context about the rejection
   */
  public readonly context?: Record<string, unknown>

  constructor(
    reason: string,
    action: IMiddlewareAction | string,
    code?: string,
    context?: Record<string, unknown>,
  ) {
    super(`Action '${action}' rejected: ${reason}`)
    this.reason = reason
    this.action = typeof action === 'string' ? action : action

    // Set error name for instanceof checks
    this.name = 'MiddlewareRejectionError'

    // Optional code and context
    this.code = code
    this.context = context

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MiddlewareRejectionError)
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   *
   * @example
   * ```ts
   * try {
   *   await middleware.executeConnection(client, 'connect')
   * } catch (error) {
   *   if (error instanceof MiddlewareRejectionError) {
   *     console.log(JSON.stringify error.toJSON())
   *   }
   * }
   * ```
   */
  toJSON(): {
    name: string
    reason: string
    action: string
    code?: string
    context?: Record<string, unknown>
    message: string
    stack?: string
  } {
    return {
      name: this.name,
      reason: this.reason,
      action: this.action,
      code: this.code,
      context: this.context,
      message: this.message,
      stack: this.stack,
    }
  }

  /**
   * Get a summary of the rejection for logging
   *
   * @example
   * ```ts
   * console.error(error.toString())
   * // Output: [MiddlewareRejectionError:connect] Authentication failed
   * ```
   */
  override toString(): string {
    return `[${this.name}:${this.action}] ${this.reason}`
  }
}

// ============================================================
// MIDDLEWARE EXECUTION ERROR
// ============================================================

/**
 * Middleware execution error
 * Thrown when a middleware function throws an unexpected error
 * (not a MiddlewareRejectionError).
 *
 * This wraps unexpected errors from middleware functions to provide
 * context about which middleware and action failed.
 *
 * @example
 * ```ts
 * import { MiddlewareExecutionError } from '@synnel/server/errors'
 *
 * const brokenMiddleware: IMiddleware = async () => {
 *   throw new Error('Something broke!')
 * }
 *
 * try {
 *   await manager.executeConnection(client, 'connect')
 * } catch (error) {
 *   if (error instanceof MiddlewareExecutionError) {
 *     console.log(`Middleware failed:`, error.cause)
 *   }
 * }
 * ```
 */
export class MiddlewareExecutionError extends Error {
  /**
   * The action being processed when the error occurred
   */
  public readonly action: string

  /**
   * The name/index of the middleware that failed
   */
  public readonly middleware: string

  /**
   * The original error thrown by the middleware
   */
  public override readonly cause: Error

  constructor(action: string, middleware: string, cause: Error) {
    super(
      `Middleware execution error in ${middleware} during ${action}: ${cause.message}`,
    )
    this.name = 'MiddlewareExecutionError'
    this.action = action
    this.middleware = middleware
    this.cause = cause

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MiddlewareExecutionError)
    }
  }

  /**
   * Get the original error cause
   */
  getCause(): Error {
    return this.cause
  }

  override toString(): string {
    return `[${this.name}] ${this.middleware} failed during ${this.action}: ${this.cause.message}`
  }
}
