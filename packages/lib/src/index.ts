/**
 * @syncar/lib
 *
 * Internal utility functions for Syncar real-time synchronization
 * This package is private and should NOT be published to npm.
 *
 * @example
 * ```ts
 * import { generateMessageId, isValidChannelName, createDefaultLogger } from '@syncar/lib'
 * ```
 */

// ID generation utilities
export {
    generateMessageId,
    generateClientId,
    randomString,
    isValidMessageId,
    isValidClientId,
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
