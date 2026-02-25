/**
 * Server Defaults
 * Default configuration values for the Synnel server.
 *
 * @module config/defaults
 */

import type { IDefaultServerConfig, IChannelOptions } from '../types'
import {
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
} from './constants'

// ============================================================
// SERVER CONFIGURATION DEFAULTS
// ============================================================

/**
 * Default server port
 * Used when no port is specified in configuration
 */
export const DEFAULT_PORT = 3000

/**
 * Default server host
 * Binds to all available network interfaces
 */
export const DEFAULT_HOST = '0.0.0.0'

/**
 * Default WebSocket path
 * WebSocket endpoint path
 */
export const DEFAULT_PATH = '/synnel'

/**
 * Default ping enabled
 * WebSocket ping/pong for connection health monitoring
 */
export const DEFAULT_ENABLE_PING = true

// Re-export from constants.ts for convenience
export { DEFAULT_PING_INTERVAL, DEFAULT_PING_TIMEOUT, DEFAULT_MAX_PAYLOAD }

// ============================================================
// DEFAULT SERVER CONFIG OBJECT
// ============================================================

/**
 * Default server configuration
 * Complete set of default values for server configuration
 *
 * @example
 * ```ts
 * import { DEFAULT_SERVER_CONFIG } from '@synnel/server/config'
 *
 * const config: IServerConfigWithDefaults = {
 *   ...DEFAULT_SERVER_CONFIG,
 *   port: 8080, // Override specific values
 * }
 * ```
 */
export const DEFAULT_SERVER_CONFIG: IDefaultServerConfig = {
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  path: DEFAULT_PATH,
  enablePing: DEFAULT_ENABLE_PING,
  pingInterval: DEFAULT_PING_INTERVAL,
  pingTimeout: DEFAULT_PING_TIMEOUT,
} as const

// ============================================================
// CHANNEL OPTIONS DEFAULTS
// ============================================================

/**
 * Default channel options
 * Default values for channel configuration
 *
 * @example
 * ```ts
 * import { DEFAULT_CHANNEL_OPTIONS } from '@synnel/server/config'
 *
 * const options: IChannelOptions = {
 *   ...DEFAULT_CHANNEL_OPTIONS,
 *   maxSubscribers: 100, // Override specific values
 * }
 * ```
 */
export const DEFAULT_CHANNEL_OPTIONS: IChannelOptions = {
  maxSubscribers: 0, // Unlimited
  reserved: false,
  historySize: 0, // No history
} as const

// ============================================================
// MESSAGE BUS OPTIONS DEFAULTS
// ============================================================

/**
 * Default auto-create channels setting
 * Automatically create channels when clients subscribe
 */
export const DEFAULT_AUTO_CREATE_CHANNELS = false

/**
 * Default auto-delete empty channels setting
 * Automatically delete channels with no subscribers
 */
export const DEFAULT_AUTO_DELETE_EMPTY_CHANNELS = false

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

// ============================================================
// DEFAULT EXPORTS
// ============================================================

/**
 * All defaults as a single object
 * Convenience export for accessing all defaults
 *
 * @example
 * ```ts
 * import { DEFAULTS } from '@synnel/server/config'
 *
 * console.log(DEFAULTS.server.port) // 3000
 * console.log(DEFAULTS.channel.maxSubscribers) // 0
 * ```
 */
export const DEFAULTS = {
  server: DEFAULT_SERVER_CONFIG,
  channel: DEFAULT_CHANNEL_OPTIONS,
  rateLimit: DEFAULT_RATE_LIMIT,
  autoCreateChannels: DEFAULT_AUTO_CREATE_CHANNELS,
  autoDeleteEmptyChannels: DEFAULT_AUTO_DELETE_EMPTY_CHANNELS,
} as const
