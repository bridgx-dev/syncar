/**
 * @synca/server
 * Node.js server for Synca real-time synchronization
 *
 * @description
 * A WebSocket server providing real-time pub/sub messaging with channels,
 * middleware support, and connection management. Built with TypeScript
 * for full type safety.
 *
 * @packageDocumentation
 *
 * @example
 * ### Quick Start
 * ```ts
 * import { createSyncaServer } from '@synca/server'
 *
 * const server = createSyncaServer({ port: 3000 })
 * await server.start()
 *
 * // Create channels
 * const broadcast = server.createBroadcast<string>()
 * const chat = server.createMulticast<string>('chat')
 *
 * // Listen for events
 * server.on('connection', (client) => {
 *   console.log(`Client connected: ${client.id}`)
 * })
 *
 * // Publish messages
 * broadcast.publish('Hello everyone!')
 * chat.publish('Welcome to chat!')
 * ```
 *
 * @example
 * ### With Middleware
 * ```ts
 * import {
 *   createSyncaServer,
 *   createAuthMiddleware,
 *   createLoggingMiddleware,
 *   createRateLimitMiddleware
 * } from '@synca/server'
 *
 * const server = createSyncaServer({
 *   port: 3000,
 *   middleware: [
 *     createAuthMiddleware({
 *       verifyToken: async (token) => jwt.verify(token, SECRET)
 *     }),
 *     createLoggingMiddleware(),
 *     createRateLimitMiddleware({ maxRequests: 100 })
 *   ]
 * })
 *
 * await server.start()
 * ```
 *
 * @remarks
 * ## Features
 *
 * - **Real-time WebSocket Communication** - Fast, bidirectional messaging
 * - **Broadcast & Multicast Channels** - Server-to-all and topic-based messaging
 * - **Middleware System** - Composable middleware for auth, logging, rate limiting
 * - **Type-Safe API** - Full TypeScript support with comprehensive types
 * - **Event-Driven Architecture** - Rich event system for lifecycle events
 * - **Connection Management** - Automatic tracking, ping/pong, graceful shutdown
 * - **Flexible Transport Layer** - Pluggable transport interface
 * - **Chunked Broadcasting** - Configurable chunking for high-volume broadcasts
 *
 * ## Installation
 *
 * ```bash
 * npm install @synca/server ws
 * ```
 *
 * ## Peer Dependencies
 *
 * - `ws@^8.0.0` - WebSocket library
 *
 * ## Modules
 *
 * - **Server** - {@link SyncaServer} | {@link createSyncaServer}
 * - **Channels** - {@link BroadcastChannel} | {@link MulticastChannel}
 * - **Middleware** - {@link createAuthMiddleware} | {@link createLoggingMiddleware} | {@link createRateLimitMiddleware}
 * - **Errors** - {@link SyncaError} | {@link MiddlewareRejectionError}
 * - **Types** - {@link IClientConnection} | {@link Message} | {@link Context} | {@link Middleware}
 *
 * @see {@link https://github.com/yourusername/synca | GitHub Repository}
 * @see {@link https://www.npmjs.com/package/@synca/server | npm Package}
 */

// ============================================================
// SERVER EXPORTS
// ============================================================

/**
 * Synca Server class and factory
 *
 * @example
 * ```ts
 * import { createSyncaServer, SyncaServer } from '@synca/server'
 *
 * const server = createSyncaServer({ port: 3000 })
 * await server.start()
 * ```
 */
export { SyncaServer, createSyncaServer } from './server'
export { SyncaServer as Synca } from './server'
export {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware'
export { ContextManager, createContext } from './context'

export {
  SyncaError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from './errors'
export { WebSocketServerTransport } from './websocket'
export { MulticastChannel, BroadcastChannel } from './channel'

export { BROADCAST_CHANNEL, CLOSE_CODES, ERROR_CODES } from './config'

export type {
  IClientConnection,
} from './types'

export type {
  IServerOptions,
  IServerStats,
} from './server'

export type {
  IChannelState,
  IPublishOptions,
  IMessageHandler,
} from './channel'

export type {
  MessageId,
  ClientId,
  SubscriberId,
  ChannelName,
  Timestamp,
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
  MessageType,
  SignalType,
  ErrorCode,
  Context,
  Middleware,
} from './types'
