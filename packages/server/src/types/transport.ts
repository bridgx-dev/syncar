/**
 * Transport Types
 * Types for the WebSocket transport layer that handles low-level communication.
 *
 * All transport implementations must implement IServerTransport.
 */

import type { IBaseTransport, IClientConnection } from './base.js'
import type { Message, ClientId } from '@synnel/types'
import type { EventEmitter } from 'node:events'

// ============================================================
// TRANSPORT EVENTS
// ============================================================

/**
 * Transport event types
 * Events that can be emitted by the transport layer.
 *
 * @example
 * ```ts
 * transport.on('connection', (conn) => { ... })
 * transport.on('disconnection', (clientId) => { ... })
 * transport.on('message', (clientId, message) => { ... })
 * transport.on('error', (error) => { ... })
 * ```
 */
export type IServerTransportEvent =
  | 'connection'     // New client connected
  | 'disconnection'  // Client disconnected
  | 'message'        // Message received from client
  | 'error'          // Transport error occurred

// ============================================================
// TRANSPORT CONFIGURATION
// ============================================================

/**
 * HTTP Server interface
 * Abstraction for HTTP servers that WebSocket can attach to.
 * We use `unknown` here to avoid coupling to specific HTTP server implementations
 * (Express, Fastify, plain Node.js http.Server, etc.)
 *
 * @example
 * ```ts
 * import { createServer } from 'http'
 * import express from 'express'
 *
 * // Plain Node.js
 * const httpServer: IHttpServer = createServer()
 *
 * // Express
 * const app = express()
 * const httpServer: IHttpServer = app.listen(3000)
 * ```
 */
export type IHttpServer = unknown

/**
 * WebSocket Server constructor interface
 * Abstracts the WebSocket server implementation for testing and flexibility.
 *
 * @example
 * ```ts
 * import { WebSocketServer } from 'ws'
 *
 * const constructor: IWebSocketServerConstructor = WebSocketServer
 * const mockConstructor: IWebSocketServerConstructor = class MockWebSocketServer {
 *   // Mock implementation
 * }
 * ```
 */
export interface IWebSocketServerConstructor {
  new (config: IWebSocketServerConfig): IWebSocketServer
}

/**
 * WebSocket Server configuration
 *
 * @example
 * ```ts
 * const config: IWebSocketServerConfig = {
 *   server: httpServer,
 *   path: '/ws',
 *   maxPayload: 1024 * 1024  // 1MB
 * }
 * ```
 */
export interface IWebSocketServerConfig {
  /** HTTP server to attach to */
  server: IHttpServer

  /** WebSocket path */
  path?: string

  /** Maximum message payload size in bytes */
  maxPayload?: number
}

/**
 * WebSocket Server interface
 * Abstraction for WebSocket server implementations.
 */
export interface IWebSocketServer {
  /** Handle the 'connection' event */
  on(event: 'connection', listener: (ws: unknown) => void): this

  /** Handle the 'error' event */
  on(event: 'error', listener: (error: Error) => void): this

  /** Handle the 'close' event */
  on(event: 'close', listener: () => void): this

  /** Handle any event */
  on(event: string, listener: (...args: unknown[]) => void): this
}

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
  /**
   * HTTP server to attach WebSocket to.
   * Works with Express, Fastify, plain Node.js http.Server, etc.
   */
  server: IHttpServer

  /**
   * Path for WebSocket connections
   * @default '/'
   */
  path?: string

  /**
   * Maximum message size in bytes
   * @default 1048576 (1MB)
   */
  maxPayload?: number

  /**
   * Enable client ping/pong for connection health monitoring
   * @default true
   */
  enablePing?: boolean

  /**
   * Ping interval in milliseconds
   * @default 30000
   */
  pingInterval?: number

  /**
   * Ping timeout in milliseconds
   * @default 5000
   */
  pingTimeout?: number

  /**
   * Custom WebSocket Server constructor
   * Useful for testing or custom implementations.
   * @default ws.Server
   */
  ServerConstructor?: IWebSocketServerConstructor
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
 * - Event emission for connection lifecycle
 *
 * @example
 * ```ts
 * class MyTransport implements IServerTransport {
 *   connections = new Map()
 *
 *   async sendToClient(clientId, message) { ... }
 *   getClients() { ... }
 *   getClient(clientId) { ... }
 *
 *   on(event, handler) { ... }
 * }
 * ```
 */
export interface IServerTransport extends IBaseTransport, EventEmitter {
  /** Map of connected clients by ID */
  connections: Map<ClientId, IClientConnection>

  /**
   * Register an event handler for transport events
   *
   * @param event - The event type to listen for
   * @param handler - The handler function
   *
   * @example
   * ```ts
   * transport.on('connection', (conn) => {
   *   console.log('Client connected:', conn.id)
   * })
   *
   * transport.on('message', (clientId, message) => {
   *   console.log('Message from:', clientId)
   * })
   * ```
   */
  on(event: 'connection', handler: (connection: IClientConnection) => void): void
  on(event: 'disconnection', handler: (clientId: ClientId) => void): void
  on(event: 'message', handler: (clientId: ClientId, message: Message) => void): void
  on(event: 'error', handler: (error: Error) => void): void
  on(event: string, handler: (...args: unknown[]) => void): void
}
