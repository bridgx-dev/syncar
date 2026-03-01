/**
 * @synnel/lib (internal)
 *
 * Internal utility functions for Synnel real-time synchronization
 * This is now part of @synnel/server internal structure.
 *
 * @example
 * ```ts
 * import { generateMessageId, isValidChannelName, createDefaultLogger } from '../lib'
 * ```
 */

// ID generation utilities
export {
  generateMessageId,
  generateClientId,
  generateSubscriberId,
  randomString,
  isValidMessageId,
  isValidClientId,
  isValidSubscriberId,
} from './id'

// Validation utilities
export {
  isValidChannelName,
  isReservedChannelName,
  isNonReservedChannelName,
  assertValidChannelName,
} from './validation'

// Message utilities
export {
  isDataMessage,
  isSignalMessage,
  isErrorMessage,
  isAckMessage,
  createDataMessage,
  createSignalMessage,
  createErrorMessage,
  createAckMessage,
} from './message'

// Logger utilities
export {
  createDefaultLogger,
  createNoOpLogger,
  createPrefixedLogger,
  createFilteredLogger,
  createThresholdLogger,
  createDebugLogger,
  createLogTimestamp,
  type LoggerFn,
  type LogLevel,
} from './logger'
