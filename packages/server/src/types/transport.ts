/**
 * Transport Types
 * Types for the WebSocket transport layer that handles low-level communication.
 *
 * All transport implementations must implement IServerTransport.
 * Transports extend EventEmitter for event handling capabilities.
 */

import type { EventEmitter } from 'node:events'
import type { IClientConnection } from './base'
import type { Message, ClientId } from '@synnel/types'

// ============================================================
// BASE TRANSPORT INTERFACE
// ============================================================

/**
 * Base transport interface
 * Single source of truth for all transport implementations.
 *
 * Transports are responsible for low-level WebSocket communication.
 * They manage connections and handle message passing.
 *
 * All transport implementations extend BaseTransport, which inherits
 * from EventEmitter, providing full event handling capabilities.
 *
 * @example
 * ```ts
 * import { BaseTransport } from '@synnel/server/transport'
 *
 * class MyTransport extends BaseTransport {
 *   connections = new Map()
 *
 *   async sendToClient(clientId, message) { ... }
 *   // EventEmitter methods inherited: on, emit, off, once, etc.
 * }
 * ```
 */
export interface IBaseTransport extends EventEmitter {
  /** Map of all connected clients by ID */
  readonly connections: Map<ClientId, IClientConnection>

  /**
   * Send a message to a specific client
   *
   * @param clientId - The target client ID
   * @param message - The message to send
   * @throws Error if client not found or not connected
   */
  sendToClient(clientId: ClientId, message: Message): Promise<void>

  /**
   * Stop the transport and clean up resources
   * Closes all connections, removes event listeners, and stops the server.
   */
  stop?(): void
}

// ============================================================
// SERVER TRANSPORT INTERFACE
// ============================================================

/**
 * Server transport interface
 * Abstracts the underlying WebSocket implementation.
 *
 * All transport implementations must implement this interface.
 * The transport handles low-level WebSocket communication including:
 * - Connection management
 * - Message sending/receiving
 * - Event emission for connection lifecycle (via EventEmitter)
 *
 * @example
 * ```ts
 * class MyTransport extends BaseTransport implements IServerTransport {
 *   connections = new Map()
 *
 *   async sendToClient(clientId, message) { ... }
 * }
 * ```
 */
export interface IServerTransport extends IBaseTransport {
  /** Map of connected clients by ID (mutable for server transports) */
  connections: Map<ClientId, IClientConnection>
}

// ============================================================
// SERVER TRANSPORT CONFIGURATION
// ============================================================

/**
 * HTTP Server type
 * Abstraction for HTTP servers that WebSocket can attach to.
 * We use `unknown` here to avoid coupling to specific HTTP server implementations
 * (Express, Fastify, plain Node.js http.Server, etc.)
 */
export type IHttpServer = unknown

/**
 * Server transport configuration options
 *
 * @example
 * ```ts
 * const config: IServerTransportConfig = {
 *   server: httpServer,
 *   path: '/ws',
 *   maxPayload: 1048576,     // 1MB
 *   enablePing: true,
 *   pingInterval: 30000,     // 30 seconds
 *   pingTimeout: 5000,        // 5 seconds
 * }
 * ```
 */
export interface IServerTransportConfig {
  /** HTTP server to attach WebSocket to */
  server: IHttpServer

  /** Path for WebSocket connections */
  path?: string

  /** Maximum message size in bytes */
  maxPayload?: number

  /** Enable client ping/pong for connection health monitoring */
  enablePing?: boolean

  /** Ping interval in milliseconds */
  pingInterval?: number

  /** Ping timeout in milliseconds */
  pingTimeout?: number

  /** Shared connection map (optional, can be provided by registry) */
  connections?: Map<ClientId, IClientConnection>

  /** Custom WebSocket Server constructor (for testing) */
  ServerConstructor?: new (config: {
    server: unknown
    path?: string
    maxPayload?: number
  }) => any
}
