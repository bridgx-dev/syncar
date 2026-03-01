/**
 * Server Defaults
 * Default configuration values for the Synnel server.
 *
 * @module config/defaults
 */

import type { IDefaultServerConfig } from '../types'
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
  rateLimit: DEFAULT_RATE_LIMIT,
} as const
