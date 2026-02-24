/**
 * @synnel/server
 * Node.js server for Synnel real-time synchronization
 */

// Main server class and factory
export { SynnelServer, createSynnelServer } from './server.js'

// Synnel class alias for cleaner API
export { SynnelServer as Synnel } from './server.js'

// Middleware
export {
  MiddlewareManager,
  MiddlewareRejectionError,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware.js'

// Base WebSocket transport
export { WebSocketServerTransport } from './base.js'

// Types
export type {
  ServerConfig,
  ServerStats,
  ServerEventType,
  ServerEventMap,
  ServerClient,
  ChannelTransport,
  BroadcastTransport,
  ServerMiddleware,
  MiddlewareContext,
  DisconnectionEvent,
  ChannelState,
  InternalChannelState,
  ChannelOptions,
  MessageBusOptions,
} from './types.js'
