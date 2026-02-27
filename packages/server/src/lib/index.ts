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
} from './id.js'

// Validation utilities
export {
  isValidChannelName,
  isReservedChannelName,
  isNonReservedChannelName,
  assertValidChannelName,
} from './validation.js'

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
} from './message.js'

// Reconnection utilities
export {
  calculateBackoff,
  calculateBackoffWithJitter,
  shouldReconnect,
  createInitialReconnectionState,
  advanceReconnectionState,
  resetReconnectionState,
  type ReconnectionState,
  type ReconnectionOptions,
  DEFAULT_RECONNECT_DELAY,
  DEFAULT_MAX_RECONNECT_DELAY,
  DEFAULT_BACKOFF_MULTIPLIER,
  DEFAULT_JITTER_FACTOR,
} from './reconnection.js'

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
} from './logger.js'
