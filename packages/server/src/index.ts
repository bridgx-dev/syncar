/**
 * @syncar/server
 * Node.js server for Syncar real-time synchronization
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
 * import { createSyncarServer } from '@syncar/server'
 *
 * const server = createSyncarServer({ port: 3000 })
 * await server.start()
 *
 * // Create channels
 * const chat = server.createChannel<string>('chat')
 *
 * // Listen for events
 * server.on('connection', (client) => {
 *   console.log(`Client connected: ${client.id}`)
 * })
 *
 * // Publish messages
 * server.broadcast('Hello everyone!')
 * chat.publish('Welcome!')
 * ```
 *
 * @example
 * ### With Middleware
 * ```ts
 * import {
 *   createSyncarServer,
 *   authenticate,
 *   logger,
 *   rateLimit
 * } from '@syncar/server'
 *
 * const server = createSyncarServer({
 *   port: 3000,
 *   middleware: [
 *     authenticate({
 *       verifyToken: async (token) => jwt.verify(token, SECRET)
 *     }),
 *     logger(),
 *     rateLimit({ maxRequests: 100 })
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
 * - **Unified Channel API** - Single channel interface for subscriber-based rooms
 * - **Middleware System** - Composable middleware for auth, logging, rate limiting
 * - **Type-Safe API** - Full TypeScript support with comprehensive types
 * - **Event-Driven Architecture** - Rich event system for lifecycle events
 * - **Connection Management** - Automatic tracking, ping/pong, graceful shutdown
 * - **Flexible Transport Layer** - Pluggable transport interface
 * - **Chunked Broadcasting** - Configurable chunking for high-volume broadcasts
 *
 * ## Installation
 *
 * ## Peer Dependencies
 *
 * - `ws@^8.0.0` - WebSocket library
 *
 * ## Modules
 *
 * - **Server** - {@link SyncarServer} | {@link createSyncarServer}
 * - **Channels** - {@link Channel}
 * - **Middleware** - {@link authenticate} | {@link logger} | {@link rateLimit}
 * - **Errors** - {@link SyncarError} | {@link MiddlewareRejectionError}
 * - **Types** - {@link IClientConnection} | {@link Message} | {@link Context} | {@link Middleware}
 *
 * @see {@link https://github.com/yourusername/syncar | GitHub Repository}
 * @see {@link https://www.npmjs.com/package/@syncar/server | npm Package}
 */

// ============================================================
// SERVER EXPORTS
// ============================================================

/**
 * Syncar Server class and factory
 *
 * @example
 * ```ts
 * import { createSyncarServer, SyncarServer } from '@syncar/server'
 *
 * const server = createSyncarServer({ port: 3000 })
 * await server.start()
 *
 * // New unified API
 * const chat = server.createChannel('chat')
 * server.broadcast('Hello everyone!')
 * ```
 */
export { SyncarServer, createSyncarServer } from './server'
export { SyncarServer as Syncar } from './server'

// New unified channel API
export { Channel } from './channel'
export { ContextManager, createContext } from './context'

export {
    SyncarError,
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

export { CLOSE_CODES, ERROR_CODES } from './config'
export type { IServerOptions, IServerStats } from './server'

export type { IChannelState, IMessageHandler } from './channel'

export type {
    MessageId,
    ClientId,
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
    IContext,
    IMiddleware,
} from './types'
