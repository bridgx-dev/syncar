/**
 * @synnel/server
 * Node.js server for Synnel real-time synchronization
 *
 * @example
 * ```ts
 * import { createSynnelServer } from '@synnel/server'
 *
 * const server = createSynnelServer({ port: 3000 })
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
 * ```
 */

export { SynnelServer, createSynnelServer } from './server'
export { SynnelServer as Synnel } from './server'
export {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware'
export { ContextManager, createContext } from './context'

export {
  SynnelError,
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
