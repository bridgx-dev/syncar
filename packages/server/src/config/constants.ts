/**
 * Server Constants
 * Single source of truth for all constant values used in the server.
 *
 * @module config/constants
 */

/**
 * Broadcast channel name
 * Messages sent to this channel reach ALL connected clients
 * No subscription required for broadcast channel
 *
 * @example
 * ```ts
 * import { BROADCAST_CHANNEL } from '@synnel/server/config'
 *
 * if (channel === BROADCAST_CHANNEL) {
 *   // Send to all clients
 * }
 * ```
 */
export const BROADCAST_CHANNEL = '__broadcast__' as const

/**
 * Type for the broadcast channel name
 */
export type BroadcastChannel = typeof BROADCAST_CHANNEL

// ============================================================
// WEBSOCKET CLOSE CODES
// ============================================================

/**
 * WebSocket close codes
 * Based on RFC 6455 and custom codes for application-specific closures
 *
 * @see https://www.iana.org/assignments/websocket/websocket.xhtml
 */
export const CLOSE_CODES = {
  /**
   * Normal closure
   * Connection closed cleanly by application
   */
  NORMAL: 1000,

  /**
   * Endpoint is going away
   * Server is shutting down or browser is navigating away
   */
  GOING_AWAY: 1001,

  /**
   * Protocol error
   * Endpoint received a message it cannot process
   */
  PROTOCOL_ERROR: 1002,

  /**
   * Unsupported data
   * Endpoint received unsupported message type
   */
  UNSUPPORTED_DATA: 1003,

  /**
   * No status received
   * Connection closed without receiving a close frame
   */
  NO_STATUS: 1005,

  /**
   * Abnormal closure
   * Connection closed abnormally (e.g., without sending or receiving a Close frame)
   */
  ABNORMAL: 1006,

  /**
   * Invalid frame payload data
   * Endpoint received inconsistent data (e.g., invalid UTF-8)
   */
  INVALID_PAYLOAD: 1007,

  /**
   * Policy violation
   * Endpoint received message violating policy
   */
  POLICY_VIOLATION: 1008,

  /**
   * Message too big
   * Endpoint received message too large to process
   */
  MESSAGE_TOO_BIG: 1009,

  /**
   * Missing extension
   * Client expected extension server didn't negotiate
   */
  MISSING_EXTENSION: 1010,

  /**
   * Internal error
   * Server encountered unexpected condition
   */
  INTERNAL_ERROR: 1011,

  /**
   * Service restart
   * Server is restarting (used in handshake)
   */
  SERVICE_RESTART: 1012,

  /**
   * Try again later
   * Server is overloaded - client should retry later
   */
  TRY_AGAIN_LATER: 1013,

  /**
   * Connection rejected by middleware
   * Custom code for application-level rejection (auth failed, etc.)
   */
  REJECTED: 4001,

  /**
   * Rate limit exceeded
   * Client sent too many requests
   */
  RATE_LIMITED: 4002,

  /**
   * Channel not found
   * Client tried to subscribe to non-existent channel
   */
  CHANNEL_NOT_FOUND: 4003,

  /**
   * Unauthorized
   * Client not authorized for this action
   */
  UNAUTHORIZED: 4005,
} as const

/**
 * Type for WebSocket close code values
 */
export type CloseCode = (typeof CLOSE_CODES)[keyof typeof CLOSE_CODES]

// ============================================================
// ERROR CODES
// ============================================================

/**
 * Application error codes
 * Used in error messages sent to clients
 */
export const ERROR_CODES = {
  /**
   * Action rejected by middleware
   * Generic rejection reason for middleware-based rejections
   */
  REJECTED: 'REJECTED',

  /**
   * Channel name missing from message
   * Data message must include channel property
   */
  MISSING_CHANNEL: 'MISSING_CHANNEL',

  /**
   * Subscribe action rejected
   * Middleware rejected the subscription request
   */
  SUBSCRIBE_REJECTED: 'SUBSCRIBE_REJECTED',

  /**
   * Unsubscribe action rejected
   * Middleware rejected the unsubscription request
   */
  UNSUBSCRIBE_REJECTED: 'UNSUBSCRIBE_REJECTED',

  /**
   * Rate limit exceeded
   * Client sent too many requests
   */
  RATE_LIMITED: 'RATE_LIMITED',

  /**
   * Authentication failed
   * Invalid or missing credentials
   */
  AUTH_FAILED: 'AUTH_FAILED',

  /**
   * Authorization failed
   * Client not allowed to perform this action
   */
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',

  /**
   * Channel not allowed
   * Client tried to access a non-whitelisted channel
   */
  CHANNEL_NOT_ALLOWED: 'CHANNEL_NOT_ALLOWED',

  /**
   * Invalid message format
   * Message does not match expected schema
   */
  INVALID_MESSAGE: 'INVALID_MESSAGE',

  /**
   * Server error
   * Internal server error occurred
   */
  SERVER_ERROR: 'SERVER_ERROR',
} as const

/**
 * Type for error code values
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

// ============================================================
// TRANSPORT CONSTANTS
// ============================================================

/**
 * Default WebSocket path
 */
export const DEFAULT_WS_PATH = '/synnel'

/**
 * Default maximum message payload size in bytes (1MB)
 */
export const DEFAULT_MAX_PAYLOAD = 1048576

/**
 * Default ping interval in milliseconds (30 seconds)
 */
export const DEFAULT_PING_INTERVAL = 30000

/**
 * Default ping timeout in milliseconds (5 seconds)
 */
export const DEFAULT_PING_TIMEOUT = 5000
