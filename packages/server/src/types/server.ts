import type { Server as HttpServer } from 'node:http'
import type { DeepPartial } from './utilities'
import type { IServerTransport } from './transport'
import type { IMiddleware } from './middleware'
import { ClientRegistry } from '../registry'

// ============================================================
// SERVER CONFIGURATION
// ============================================================

/**
 * Server configuration options
 *
 * @example
 * ```ts
 * const config: IServerConfig = {
 *   port: 3000,
 *   host: '0.0.0.0',
 *   path: '/ws',
 *   enablePing: true,
 *   pingInterval: 5000,
 *   middleware: [authMiddleware, loggingMiddleware]
 * }
 *
 * // Or with existing HTTP server
 * import express from 'express'
 * const app = express()
 * const httpServer = app.listen(3000)
 *
 * const config: IServerConfig = {
 *   server: httpServer,
 *   path: '/ws'
 * }
 * ```
 */
export interface IServerConfig {
  /**
   * Existing HTTP server to attach WebSocket to
   * If provided, port/host options are ignored
   *
   * @example
   * ```ts
   * import express from 'express'
   * const app = express()
   * const server = app.listen(3000)
   *
   * const config: IServerConfig = { server }
   * ```
   */
  server?: HttpServer

  /**
   * Server port (only used if `server` option is not provided)
   * @default 3000
   */
  port?: number

  /**
   * Server host (only used if `server` option is not provided)
   * @default '0.0.0.0'
   */
  host?: string

  /**
   * Path for WebSocket connections
   * @default '/synnel'
   */
  path?: string

  /**
   * Transport layer for WebSocket communication (advanced use)
   * If not provided, a default WebSocketServerTransport will be created
   * Mutually exclusive with `server` option
   */
  transport?: IServerTransport

  /**
   * Enable WebSocket ping/pong messages to keep connections alive
   * @default true
   */
  enablePing?: boolean

  /**
   * Interval in milliseconds to send ping messages
   * @default 5000
   */
  pingInterval?: number

  /**
   * Timeout in milliseconds to wait for a pong response before disconnecting
   * @default 5000
   */
  pingTimeout?: number

  /**
   * Custom client registry (optional)
   */
  registry?: ClientRegistry

  /**
   * Middleware functions for processing messages and connections
   *
   * @example
   * ```ts
   * middleware: [
   *   createAuthMiddleware({ verify: verifyToken }),
   *   createLoggingMiddleware({
   *     actions: ['connect'],
   *     logger,
   *     logLevel: 'log',
   *   }),
   *   createRateLimitMiddleware({ maxMessages: 100 })
   * ]
   * ```
   */
  middleware?: IMiddleware[]

  /**
   * Maximum number of subscribers to process in a single synchronous chunk
   * during broadcasting. Higher values process faster but may block the event loop.
   * @default 500
   */
  broadcastChunkSize?: number
}

/**
 * Default server configuration values
 */
export interface IDefaultServerConfig {
  port: number
  host: string
  path: string
  enablePing: boolean
  pingInterval: number
  pingTimeout: number
  broadcastChunkSize: number
}

/**
 * Server configuration options for internal use with all required fields
 */
export interface IServerOptions extends IDefaultServerConfig {
  server?: HttpServer
  transport?: IServerTransport
  registry: ClientRegistry
  middleware: IMiddleware[]
}

/**
 * Partial server configuration for incremental updates
 */
export type IPartialServerConfig = DeepPartial<IServerConfig>

// ============================================================
// SERVER STATISTICS
// ============================================================

/**
 * Server statistics
 * Provides runtime metrics about the server state.
 *
 * @example
 * ```ts
 * const stats: IServerStats = server.getStats()
 * console.log(`Connected clients: ${stats.clientCount}`)
 * console.log(`Active channels: ${stats.channelCount}`)
 * console.log(`Server uptime: ${Date.now() - stats.startedAt!}ms`)
 * ```
 */
export interface IServerStats {
  /** Number of currently connected clients */
  clientCount: number

  /** Number of active channels */
  channelCount: number

  /** Total number of subscriptions across all channels */
  subscriptionCount: number

  /** Server start timestamp (undefined if not started) */
  startedAt?: number
}

