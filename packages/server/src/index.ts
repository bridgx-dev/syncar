/**
 * @synnel/server
 * Node.js server for Synnel real-time synchronization
 */

// Main server class and factory
export { SynnelServer, createSynnelServer } from './server.js'

// Middleware
export {
  MiddlewareManager,
  MiddlewareRejectionError,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware.js'

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
} from './types.js'
