/**
 * Server Types
 * Type definitions for the @synnel/server package
 */

import type {
  Message,
  DataMessage,
  ChannelName,
  ClientId,
  Timestamp,
} from '@synnel/types'
import type { Server as HttpServer } from 'http'

// ============================================================
// BASE TRANSPORT TYPES (from base.ts)
// ============================================================

/**
 * Server transport event types
 */
export type ServerTransportEvent =
  | 'connection'
  | 'disconnection'
  | 'message'
  | 'error'

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
   * const transport = new WebSocketServerTransport({ server })
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
 * Client connection representation
 */
export type ClientConnection = {
  /** Unique client identifier */
  id: string

  /**
   * Connected timestamp
   */
  connectedAt: Timestamp

  /**
   * Last ping timestamp
   */
  lastPingAt?: Timestamp

  /** WebSocket instance for this connection */
  socket: unknown
}

// ============================================================
// SERVER TRANSPORT INTERFACE
// ============================================================

/**
 * Server transport interface
 * Abstracts the underlying WebSocket implementation
 */
export interface ServerTransport {
  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: ClientId, message: Message): Promise<void>

  /**
   * Get all connected clients
   */
  getClients(): ClientConnection[]

  /**
   * Get client by ID
   */
  getClient(clientId: ClientId): ClientConnection | undefined

  /**
   * Register an event handler
   */
  on(event: 'connection', handler: (connection: ClientConnection) => void): void
  on(event: 'disconnection', handler: (clientId: ClientId) => void): void
  on(
    event: 'message',
    handler: (clientId: ClientId, message: Message) => void,
  ): void
  on(event: 'error', handler: (error: Error) => void): void
  on(event: string, handler: (...args: any[]) => void): void
}

// ============================================================
// SERVER CONFIGURATION
// ============================================================

/**
 * Server configuration options
 */
export interface ServerConfig {
  /**
   * Existing HTTP server to attach WebSocket to
   * If provided, port/host options are ignored
   * Works with Express, Fastify, plain Node.js http.Server, etc.
   *
   * @example
   * ```ts
   * import express from 'express'
   * const app = express()
   * const server = app.listen(3000)
   * const synnel = new Synnel({ server })
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
  transport?: ServerTransport

  /**
   * Enable WebSocket ping/pong messages to keep connections alive
   * If `pingInterval` is set, this is automatically considered true
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
   * Middleware functions for processing messages and connections
   */
  middleware?: ServerMiddleware[]
}

// ============================================================
// SERVER STATISTICS
// ============================================================

/**
 * Server statistics
 */
export interface ServerStats {
  /**
   * Number of connected clients
   */
  clientCount: number

  /**
   * Number of active channels
   */
  channelCount: number

  /**
   * Number of subscriptions across all channels
   */
  subscriptionCount: number

  /**
   * Messages received
   */
  messagesReceived: number

  /**
   * Messages sent
   */
  messagesSent: number

  /**
   * Server start time
   */
  startedAt?: number
}

// ============================================================
// SERVER EVENTS
// ============================================================

/**
 * Server event types
 */
export type ServerEventType =
  | 'connection'
  | 'disconnection'
  | 'message'
  | 'subscribe'
  | 'unsubscribe'
  | 'error'

/**
 * Server event map
 */
export interface ServerEventMap {
  /**
   * Fired when a new client connects
   */
  connection: (client: ServerClient) => void

  /**
   * Fired when a client disconnects
   */
  disconnection: (client: ServerClient) => void

  /**
   * Fired when a message is received from a client
   */
  message: (client: ServerClient, message: Message) => void

  /**
   * Fired when a client subscribes to a channel
   */
  subscribe: (client: ServerClient, channel: ChannelName) => void

  /**
   * Fired when a client unsubscribes from a channel
   */
  unsubscribe: (client: ServerClient, channel: ChannelName) => void

  /**
   * Fired when an error occurs
   */
  error: (error: Error) => void
}

// ============================================================
// SERVER CLIENT
// ============================================================

/**
 * Server client wrapper
 * Extends ClientConnection with server-side methods
 */
export interface ServerClient extends ClientConnection {
  /**
   * Unique client ID (re-declared for type safety)
   */
  id: ClientId

  /**
   * Connected timestamp (re-declared for type safety)
   */
  connectedAt: Timestamp

  /**
   * Last ping timestamp (re-declared for type safety)
   */
  lastPingAt?: Timestamp

  /**
   * Send a message to this client
   */
  send(message: Message): Promise<void>

  /**
   * Disconnect this client
   */
  disconnect(code?: number, reason?: string): Promise<void>

  /**
   * Get channels this client is subscribed to
   */
  getSubscriptions(): ChannelName[]

  /**
   * Check if client is subscribed to a channel
   */
  hasSubscription(channel: ChannelName): boolean
}

/**
 * Disconnection event
 */
export interface DisconnectionEvent {
  /** Client ID */
  clientId: ClientId
  /** Disconnection code */
  code?: number
  /** Disconnection reason */
  reason?: string
}

// ============================================================
// CHANNEL TRANSPORT
// ============================================================

/**
 * Channel transport API
 * Used for sending messages to a specific channel
 */
export interface ChannelTransport<T = unknown> {
  /**
   * Channel name
   */
  readonly name: ChannelName

  /**
   * Number of subscribers
   */
  readonly subscriberCount: number

  /**
   * Send data to all subscribers except the sender
   */
  send(data: T, excludeClientId?: ClientId): Promise<void>

  /**
   * Send data to a specific client in the channel
   */
  sendTo(clientId: ClientId, data: T): Promise<void>

  /**
   * Register a handler for incoming messages on this channel
   */
  onMessage(
    handler: (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>,
  ): () => void

  /**
   * Register a handler for incoming messages (alias for onMessage)
   * Provides a more intuitive API for receiving messages on a channel
   * @example
   * ```ts
   * const chat = synnel.multicast('chat')
   * chat.receive((data, client) => {
   *   console.log(`Received from ${client.id}:`, data)
   * })
   * ```
   */
  receive(
    handler: (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>,
  ): () => void

  /**
   * Register a handler for new subscriptions
   */
  onSubscribe(
    handler: (client: ServerClient) => void | Promise<void>,
  ): () => void

  /**
   * Register a handler for unsubscriptions
   */
  onUnsubscribe(
    handler: (client: ServerClient) => void | Promise<void>,
  ): () => void

  /**
   * Get all subscribers
   */
  getSubscribers(): ServerClient[]

  /**
   * Check if a client is subscribed
   */
  hasSubscriber(clientId: string): boolean
}

// ============================================================
// BROADCAST TRANSPORT
// ============================================================

/**
 * Broadcast transport API
 * Used for sending messages to all connected clients
 */
export interface BroadcastTransport<T = unknown> {
  /**
   * Send data to all connected clients
   */
  send(data: T): Promise<void>

  /**
   * Send data to all clients except the sender
   */
  sendExcept(data: T, excludeClientId: ClientId): Promise<void>

  /**
   * Register a handler for incoming broadcast messages
   */
  onMessage(
    handler: (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>,
  ): () => void
}

// ============================================================
// MIDDLEWARE
// ============================================================

/**
 * Middleware function
 * Can be used for authentication, logging, rate limiting, etc.
 */
export type ServerMiddleware = (
  context: MiddlewareContext,
) => void | Promise<void>

/**
 * Context passed to middleware functions
 */
export interface MiddlewareContext {
  /**
   * The client (undefined for server-level middleware)
   */
  client?: ServerClient

  /**
   * The message (undefined for connection events)
   */
  message?: Message

  /**
   * Channel name (for channel-specific operations)
   */
  channel?: ChannelName

  /**
   * Action being performed
   */
  action: 'connect' | 'disconnect' | 'message' | 'subscribe' | 'unsubscribe'

  /**
   * Reject the action with an error
   * Call this to prevent the action from completing
   */
  reject(reason: string): void
}

// ============================================================
// CHANNEL STATE
// ============================================================

/**
 * Channel state (internal)
 */
export interface ChannelState<T = unknown> {
  /**
   * Channel name
   */
  name: ChannelName

  /**
   * Subscribed client IDs
   */
  subscribers: Set<ClientId>

  /**
   * Message handlers
   */
  messageHandlers: Set<
    (
      data: T,
      client: ServerClient,
      message: DataMessage<T>,
    ) => void | Promise<void>
  >

  /**
   * Subscribe handlers
   */
  subscribeHandlers: Set<(client: ServerClient) => void | Promise<void>>

  /**
   * Unsubscribe handlers
   */
  unsubscribeHandlers: Set<(client: ServerClient) => void | Promise<void>>
}
