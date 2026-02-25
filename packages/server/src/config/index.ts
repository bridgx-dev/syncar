/**
 * Config Module
 * Configuration constants and defaults for the Synnel server.
 *
 * @module config
 *
 * @example
 * ```ts
 * // Import constants
 * import { BROADCAST_CHANNEL, CLOSE_CODES, ERROR_CODES } from '@synnel/server/config'
 *
 * // Import defaults
 * import { DEFAULT_SERVER_CONFIG, DEFAULT_CHANNEL_OPTIONS } from '@synnel/server/config'
 *
 * // Import all defaults
 * import { DEFAULTS } from '@synnel/server/config'
 * ```
 */

export {
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
  DEFAULT_WS_PATH,
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_SUBSCRIBERS,
  DEFAULT_HISTORY_SIZE,
  DEFAULT_EMPTY_CHANNEL_GRACE_PERIOD,
  type BroadcastChannel,
  type CloseCode,
  type ErrorCode,
} from './constants'

export {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_ENABLE_PING,
  DEFAULT_SERVER_CONFIG,
  DEFAULT_CHANNEL_OPTIONS,
  DEFAULT_AUTO_CREATE_CHANNELS,
  DEFAULT_AUTO_DELETE_EMPTY_CHANNELS,
  DEFAULT_RATE_LIMIT,
  DEFAULTS,
} from './defaults'
