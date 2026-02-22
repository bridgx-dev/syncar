/**
 * Adapter-Ws Types
 * WebSocket transport adapter types for Synnel v2
 */

import type { WebSocket } from 'ws'
import type { Message } from '@synnel/core'

/**
 * Transport status
 */
export type TransportStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'

/**
 * Transport events
 */
export type TransportEventType = 'open' | 'message' | 'error' | 'close'

/**
 * Transport event map
 */
export interface TransportEventMap {
  open: () => void
  message: (message: Message) => void
  error: (error: Error) => void
  close: (event: CloseEvent) => void
}

/**
 * Base transport configuration
 */
export interface TransportConfig {
  /**
   * WebSocket URL
   */
  url: string

  /**
   * Enable automatic reconnection
   * @default false
   */
  reconnect?: boolean

  /**
   * Maximum reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number

  /**
   * Initial reconnection delay in ms
   * @default 1000
   */
  reconnectDelay?: number

  /**
   * Maximum reconnection delay in ms
   * @default 30000
   */
  maxReconnectDelay?: number

  /**
   * Connection timeout in ms
   * @default 10000
   */
  connectionTimeout?: number

  /**
   * WebSocket protocols
   */
  protocols?: string | string[]

  /**
   * Custom WebSocket constructor (for testing or custom implementations)
   */
  WebSocketConstructor?: typeof WebSocket
}

/**
 * Server transport configuration
 */
export interface ServerTransportConfig {
  /**
   * Existing HTTP server to attach WebSocket to
   * Works with Express, Fastify, plain Node.js http.Server, etc.
   *
   * @example
   * ```ts
   * import express from 'express'
   * import { createServer } from 'http'
   *
   * const app = express()
   * const server = createServer(app)
   *
   * const transport = createWebSocketServerTransport({ server })
   * ```
   */
  server: unknown

  /**
   * Path for WebSocket connections
   * If not provided, the WebSocket server will use its default path
   */
  path?: string

  /**
   * Maximum message size in bytes
   * @default 1048576 (1MB)
   */
  maxPayload?: number

  /**
   * Enable client ping/pong
   * @default true
   */
  enablePing?: boolean

  /**
   * Ping interval in ms
   * @default 30000
   */
  pingInterval?: number

  /**
   * Ping timeout in ms
   * @default 5000
   */
  pingTimeout?: number

  /**
   * Custom WebSocket Server (for testing)
   */
  ServerConstructor?: unknown
}

/**
 * Close event
 */
export interface CloseEvent {
  /**
   * Was the connection clean?
   */
  wasClean: boolean

  /**
   * Close code
   */
  code: number

  /**
   * Close reason
   */
  reason: string
}

/**
 * Client connection info (server-side)
 */
export interface ClientConnection {
  /**
   * Unique client ID
   */
  id: string

  /**
   * Connection status
   */
  status: TransportStatus

  /**
   * Connected timestamp
   */
  connectedAt: number

  /**
   * Last ping timestamp
   */
  lastPingAt?: number

  /**
   * Custom metadata
   */
  metadata: Record<string, unknown>
}

/**
 * Wrapper for WebSocket server connections
 */
export interface ServerConnection extends ClientConnection {
  ws: InstanceType<typeof WebSocket>
}

/**
 * Transport interface
 * All transport adapters must implement this interface
 */
export interface Transport {
  /**
   * Current transport status
   */
  readonly status: TransportStatus

  /**
   * Connect to the server
   */
  connect(): Promise<void>

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>

  /**
   * Send a message
   */
  send(message: Message): Promise<void>

  /**
   * Register an event handler
   */
  on<E extends TransportEventType>(
    event: E,
    handler: TransportEventMap[E],
  ): () => void

  /**
   * Get connection info
   */
  getConnectionInfo(): { connectedAt?: number; url?: string }
}

import type EventEmitter from 'node:events'

/**
 * Server transport interface
 */
export interface ServerTransport extends Omit<EventEmitter, 'on'> {
  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: Message): Promise<void>

  /**
   * Disconnect a specific client
   */
  disconnectClient(
    clientId: string,
    code?: number,
    reason?: string,
  ): Promise<void>

  /**
   * Get all connected clients
   */
  getClients(): ClientConnection[]

  /**
   * Get client by ID
   */
  getClient(clientId: string): ClientConnection | undefined

  /**
   * Register an event handler
   */
  on<E extends ServerTransportEventType>(
    event: E,
    handler: ServerTransportEventMap[E],
  ): this

  /**
   * Get server info
   */
  getServerInfo(): {
    path?: string
    startedAt?: number
  }
}

/**
 * Server transport events
 */
export type ServerTransportEventType =
  | 'connection'
  | 'disconnection'
  | 'message'
  | 'error'

/**
 * Server transport event map
 */
export interface ServerTransportEventMap {
  connection: (clientId: string) => void
  disconnection: (clientId: string, event: CloseEvent) => void
  message: (clientId: string, message: Message) => void
  error: (error: Error) => void
}

/**
 * Reconnection state
 */
export interface ReconnectionState {
  /**
   * Number of reconnection attempts
   */
  attempts: number

  /**
   * Current delay in ms
   */
  currentDelay: number

  /**
   * Whether reconnection is enabled
   */
  enabled: boolean

  /**
   * Timeout ID for next attempt
   */
  timeoutId?: ReturnType<typeof setTimeout>
}
