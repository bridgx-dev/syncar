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
export type { Context, Middleware } from './types'
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

export {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_SERVER_CONFIG,
  DEFAULTS,
} from './config'

export { BROADCAST_CHANNEL, CLOSE_CODES, ERROR_CODES } from './config'

export { ClientRegistry } from './registry'

export { ConnectionHandler, MessageHandler, SignalHandler } from './handlers'

export type {
  MergeTypes,
  DeepPartial,
  Prettify,
  Branded,
  Awaited,
  FnParameters,
  FnReturnType,
  ArrayElement,
  ValueOf,
  TupleToUnion,
  IClientConnection,
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
  IPublishOptions,
  IBaseTransport,
  IHttpServer,
  IServerTransportConfig,
  IServerTransport,
  IClientRegistry,
  IDisconnectionEvent,
  IChannelState,
  IChannelTransport,
  IBroadcastTransport,
  IMulticastTransport,
  IMiddlewareAction,
  IMiddlewareContext,
  IMiddleware,
  IContextManager,
  IMiddlewareRejectionError,
  IMiddlewareContextFactory,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
  IServerConfig,
  IServerOptions,
  IDefaultServerConfig,
  IPartialServerConfig,
  IServerStats,
  ISynnelServer,
} from './types'

export type {
  MessageId,
  ClientId,
  SubscriberId,
  ChannelName,
  Timestamp,
  DataPayload,
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
  ErrorData,
  MessageType,
  SignalType,
  ErrorCode,
} from './types'
