/**
 * Config Module
 * Single source of truth for all constant values and default configuration for the server.
 *
 * @module config
 */

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Broadcast channel name
 * Messages sent to this channel reach ALL connected clients
 * No subscription required for broadcast channel
 */
export const BROADCAST_CHANNEL = '__broadcast__' as const

/**
 * Type for the broadcast channel name
 */
export type BroadcastChannel = typeof BROADCAST_CHANNEL

/**
 * WebSocket close codes
 * Based on RFC 6455 and custom codes for application-specific closures
 */
export const CLOSE_CODES = {
    /**
     * Normal closure
     */
    NORMAL: 1000,

    /**
     * Endpoint is going away
     */
    GOING_AWAY: 1001,

    /**
     * Protocol error
     */
    PROTOCOL_ERROR: 1002,

    /**
     * Unsupported data
     */
    UNSUPPORTED_DATA: 1003,

    /**
     * No status received
     */
    NO_STATUS: 1005,

    /**
     * Abnormal closure
     */
    ABNORMAL: 1006,

    /**
     * Invalid frame payload data
     */
    INVALID_PAYLOAD: 1007,

    /**
     * Policy violation
     */
    POLICY_VIOLATION: 1008,

    /**
     * Message too big
     */
    MESSAGE_TOO_BIG: 1009,

    /**
     * Missing extension
     */
    MISSING_EXTENSION: 1010,

    /**
     * Internal error
     */
    INTERNAL_ERROR: 1011,

    /**
     * Service restart
     */
    SERVICE_RESTART: 1012,

    /**
     * Try again later
     */
    TRY_AGAIN_LATER: 1013,

    /**
     * Connection rejected by middleware
     */
    REJECTED: 4001,

    /**
     * Rate limit exceeded
     */
    RATE_LIMITED: 4002,

    /**
     * Channel not found
     */
    CHANNEL_NOT_FOUND: 4003,

    /**
     * Unauthorized
     */
    UNAUTHORIZED: 4005,
} as const

/**
 * Type for WebSocket close code values
 */
export type CloseCode = (typeof CLOSE_CODES)[keyof typeof CLOSE_CODES]

/**
 * Application error codes
 * Used in error messages sent to clients
 */
export const ERROR_CODES = {
    /**
     * Action rejected by middleware
     */
    REJECTED: 'REJECTED',

    /**
     * Channel name missing from message
     */
    MISSING_CHANNEL: 'MISSING_CHANNEL',

    /**
     * Subscribe action rejected
     */
    SUBSCRIBE_REJECTED: 'SUBSCRIBE_REJECTED',

    /**
     * Unsubscribe action rejected
     */
    UNSUBSCRIBE_REJECTED: 'UNSUBSCRIBE_REJECTED',

    /**
     * Rate limit exceeded
     */
    RATE_LIMITED: 'RATE_LIMITED',

    /**
     * Authentication failed
     */
    AUTH_FAILED: 'AUTH_FAILED',

    /**
     * Authorization failed
     */
    NOT_AUTHORIZED: 'NOT_AUTHORIZED',

    /**
     * Channel not allowed
     */
    CHANNEL_NOT_ALLOWED: 'CHANNEL_NOT_ALLOWED',

    /**
     * Invalid message format
     */
    INVALID_MESSAGE: 'INVALID_MESSAGE',

    /**
     * Server error
     */
    SERVER_ERROR: 'SERVER_ERROR',
} as const

/**
 * Type for error code values
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

// ============================================================
// DEFAULTS
// ============================================================

/**
 * Default WebSocket path
 */
export const DEFAULT_WS_PATH = '/syncar'

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

/**
 * Default server port
 */
export const DEFAULT_PORT = 3000

/**
 * Default server host
 */
export const DEFAULT_HOST = '0.0.0.0'

/**
 * Default WebSocket path
 */
export const DEFAULT_PATH = '/syncar'

/**
 * Default ping enabled
 */
export const DEFAULT_ENABLE_PING = true

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG = {
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
    path: DEFAULT_PATH,
    enablePing: DEFAULT_ENABLE_PING,
    pingInterval: DEFAULT_PING_INTERVAL,
    pingTimeout: DEFAULT_PING_TIMEOUT,
    broadcastChunkSize: 500,
} as const

/**
 * Default rate limit settings
 */
export const DEFAULT_RATE_LIMIT = {
    /**
     * Default maximum messages per time window
     */
    maxMessages: 100,

    /**
     * Default time window in milliseconds (1 minute)
     */
    windowMs: 60000,
} as const

/**
 * All defaults as a single object
 */
export const DEFAULTS = {
    server: DEFAULT_SERVER_CONFIG,
    rateLimit: DEFAULT_RATE_LIMIT,
} as const
