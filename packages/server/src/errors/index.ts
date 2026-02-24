/**
 * Errors Module
 * Custom error classes for the Synnel server.
 *
 * @module errors
 *
 * @example
 * ```ts
 * // Import base error class
 * import { SynnelError } from '@synnel/server/errors'
 *
 * // Import specific error classes
 * import {
 *   ConfigError,
 *   TransportError,
 *   ChannelError,
 *   ClientError,
 *   MiddlewareRejectionError
 * } from '@synnel/server/errors'
 * ```
 */

// ============================================================
// BASE ERROR CLASS
// ============================================================

export {
  SynnelError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
} from './base.js'

// ============================================================
// MIDDLEWARE ERRORS
// ============================================================

export {
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from './middleware.js'

// Re-export types for convenience
export type { IMiddlewareRejectionError } from '../types/index.js'
