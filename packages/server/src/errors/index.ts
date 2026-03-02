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

export {
  SynnelError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
} from './base'

export {
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from './middleware'
