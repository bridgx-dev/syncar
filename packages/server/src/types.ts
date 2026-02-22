/**
 * Server Types
 * Type definitions for the @synnel/server package
 */

import type { Message, DataMessage, ChannelName } from '@synnel/core'
import type { ServerTransport, ClientConnection } from '@synnel/adapter'
import type { Server as HttpServer } from 'http'

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
   * Transport layer for WebSocket communication (advanced use)
   * If not provided, a default WebSocketServerTransport will be created
   * Mutually exclusive with `server` option
   */
  transport?: ServerTransport

  /**
   * Middleware functions for processing messages and connections
   */
  middleware?: ServerMiddleware[]
}

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

  /**
   * Transport info
   */
  transport: {
    path?: string
  }
}

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
  disconnection: (client: ServerClient, event: DisconnectionEvent) => void

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

/**
 * Disconnection event details
 */
export interface DisconnectionEvent {
  /**
   * Whether the disconnection was clean (WebSocket close code 1000)
   */
  wasClean: boolean

  /**
   * WebSocket close code
   */
  code: number

  /**
   * Close reason
   */
  reason: string
}

/**
 * Server client wrapper
 * Extends ClientConnection with server-side methods
 */
export interface ServerClient extends ClientConnection {
  /**
   * Unique client ID (re-declared for type safety)
   */
  id: string

  /**
   * Connection status (re-declared for type safety)
   */
  status: 'connected' | 'disconnected' | 'connecting' | 'disconnecting'

  /**
   * Connected timestamp (re-declared for type safety)
   */
  connectedAt: number

  /**
   * Last ping timestamp (re-declared for type safety)
   */
  lastPingAt?: number

  /**
   * Custom metadata (re-declared for type safety)
   */
  metadata: Record<string, unknown>

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

  /**
   * Set custom metadata on the client
   */
  setMetadata(key: string, value: unknown): void

  /**
   * Get custom metadata from the client
   */
  getMetadata<T = unknown>(key: string): T | undefined
}

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
  send(data: T, excludeClientId?: string): Promise<void>

  /**
   * Send data to a specific client in the channel
   */
  sendTo(clientId: string, data: T): Promise<void>

  /**
   * Register a handler for incoming messages on this channel
   */
  onMessage(
    handler: (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>,
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
    handler: (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>,
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
  sendExcept(data: T, excludeClientId: string): Promise<void>

  /**
   * Register a handler for incoming broadcast messages
   */
  onMessage(
    handler: (data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>,
  ): () => void
}

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

/**
 * Channel state
 */
export interface ChannelState<T = unknown> {
  /**
   * Channel name
   */
  name: ChannelName

  /**
   * Subscribed client IDs
   */
  subscribers: Set<string>

  /**
   * Message handlers
   */
  messageHandlers: Set<(data: T, client: ServerClient, message: DataMessage<T>) => void | Promise<void>>

  /**
   * Subscribe handlers
   */
  subscribeHandlers: Set<(client: ServerClient) => void | Promise<void>>

  /**
   * Unsubscribe handlers
   */
  unsubscribeHandlers: Set<(client: ServerClient) => void | Promise<void>>
}
