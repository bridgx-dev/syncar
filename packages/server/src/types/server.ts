/**
 * Server Types
 * Types for server configuration and state management.
 */

import type { Server as HttpServer } from 'node:http'
import type { DeepPartial } from './utilities'
import type { ClientId } from './common'
import type { IServerTransport } from './transport'
import type { IMiddleware } from './middleware'
import type { IClientRegistry } from './client'
import type { IClientConnection } from './base'
import type { IBroadcastTransport, IMulticastTransport } from './channel'

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
  registry?: IClientRegistry

  /**
   * Shared connection map (optional, shared with transport)
   */
  connections?: Map<ClientId, IClientConnection>

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
 * Server configuration with defaults applied
 */
export type IServerConfigWithDefaults = IServerConfig & IDefaultServerConfig

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

// ============================================================
// SERVER INTERFACE
// ============================================================

/**
 * Synnel server interface
 * Main server interface for real-time WebSocket communication.
 *
 * @example
 * ```ts
 * // Server type usage
 * const server: ISynnelServer = ...
 *
 * // Start/stop server
 * await server.start()
 * await server.stop()
 *
 * // Create channels
 * const broadcast = server.createBroadcast<string>()
 * const chat = server.createMulticast<string>('chat', {
 *   maxSubscribers: 100,
 *   historySize: 50
 * })
 *
 * // Listen for events
 * const unsubscribe = server.on('connection', (client) => {
 *   console.log(`Client connected: ${client.id}`)
 * })
 *
 * // Get stats
 * const stats = server.getStats()
 * ```
 */
export interface ISynnelServer {
  // ============================================================
  // LIFECYCLE METHODS
  // ============================================================

  /**
   * Start the server
   * Begins listening for connections if using built-in HTTP server.
   *
   * @throws Error if server is already started
   */
  start(): Promise<void>

  /**
   * Stop the server
   * Closes all connections and stops listening.
   */
  stop(): Promise<void>

  // ============================================================
  // CHANNEL METHODS
  // ============================================================

  /**
   * Create a broadcast transport for server-to-all communication
   *
   * @template T The type of data to broadcast
   * @returns Broadcast transport instance
   *
   * @example
   * ```ts
   * const broadcast = server.createBroadcast<string>()
   * broadcast.publish('Hello everyone!')
   * ```
   */
  createBroadcast<T = unknown>(): IBroadcastTransport<T>

  /**
   * Create or get a multicast transport for topic-based messaging
   *
   * @template T The type of data for this channel
   * @param name - Channel name
   * @param options - Channel options
   * @returns Multicast transport instance
   *
   * @example
   * ```ts
   * const chat = server.createMulticast<string>('chat', {
   *   maxSubscribers: 100,
   *   historySize: 50
   * })
   *
   * chat.receive((data, client) => {
   *   console.log(`${client.id}: ${data}`)
   * })
   * ```
   */
  createMulticast<T = unknown>(
    name: import('./common').ChannelName,
  ): IMulticastTransport<T>

  /**
   * Check if a channel exists
   *
   * @param name - Channel name to check
   * @returns true if channel exists, false otherwise
   */
  hasChannel(name: import('./common').ChannelName): boolean

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Get server statistics
   *
   * @returns Server statistics
   */
  getStats(): IServerStats

  /**
   * Register a middleware function
   *
   * @param middleware - The middleware to register
   */
  use(middleware: IMiddleware): void



  /**
   * Get the client registry
   */
  getRegistry(): IClientRegistry

  /**
   * Get the server configuration
   */
  getConfig(): Readonly<IServerConfig>
}

