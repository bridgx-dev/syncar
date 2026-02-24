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

// ============================================================
// SERVER
// ============================================================

export {
  SynnelServer,
  createSynnelServer,
} from './server/index.js'

// Synnel class alias for cleaner API
export { SynnelServer as Synnel } from './server/index.js'

// ============================================================
// MIDDLEWARE
// ============================================================

export {
  MiddlewareManager,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware/index.js'

// ============================================================
// ERRORS
// ============================================================

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
} from './errors/index.js'

// ============================================================
// TRANSPORT
// ============================================================

export {
  WebSocketServerTransport,
} from './transport/index.js'

// ============================================================
// CHANNELS
// ============================================================

export {
  BaseChannel,
  BroadcastTransport,
  MulticastTransport,
} from './channel/index.js'

// ============================================================
// CONFIG
// ============================================================

export {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_SERVER_CONFIG,
  DEFAULT_CHANNEL_OPTIONS,
  DEFAULTS,
} from './config/index.js'

export {
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
  DEFAULT_MAX_SUBSCRIBERS,
  DEFAULT_HISTORY_SIZE,
} from './config/constants.js'

// ============================================================
// REGISTRY
// ============================================================

export {
  ClientRegistry,
  ServerClientFactory,
  defaultClientFactory,
} from './registry/index.js'

// ============================================================
// HANDLERS
// ============================================================

export {
  ConnectionHandler,
  MessageHandler,
  SignalHandler,
} from './handlers/index.js'

// ============================================================
// TYPES - Re-export all types from types/index.js
// ============================================================

export type {
  // Utility types
  MergeTypes,
  DeepPartial,
  DeepReadonly,
  Prettify,
  KeysOfType,
  PickByType,
  OmitByType,
  RequiredKeys,
  OptionalKeys,
  Branded,
  Awaited,
  FnParameters,
  FnReturnType,
  FunctionPropertyNames,
  OnlyMethods,
  OptionalKeysOf,
  RequiredKeysOf,
  ArrayElement,
  ValueOf,
  UnionToIntersection,
  LastOfTuple,
  TupleToUnion,
  // Base types
  IClientConnection,
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
  IPublishOptions,
  // Transport types
  IBaseTransport,
  IHttpServer,
  IServerTransportConfig,
  IServerTransport,
  // Client types
  IClientData,
  IServerClient,
  IClientRegistry,
  IServerClientFactory,
  IClientWithMetadata,
  IDisconnectionEvent,
  // Channel types
  IChannelState,
  IChannelOptions,
  IMessageHistory,
  IChannelTransport,
  IBroadcastTransport,
  IMulticastTransport,
  IInternalChannelState,
  IMessageBusOptions,
  // Middleware types
  IMiddlewareAction,
  IMiddlewareContext,
  IMiddleware,
  IMiddlewareManager,
  IMiddlewareRejectionError,
  IMiddlewareContextFactory,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
  // Server config types
  IServerConfig,
  IDefaultServerConfig,
  IServerConfigWithDefaults,
  IPartialServerConfig,
  IServerStats,
  ISynnelServer,
  // Event types
  IServerEventType,
  IServerEventMap,
  IEventHandler,
  IEventDataType,
  IEventUnsubscriber,
  IEventEmitter,
  IEventListenerStorage,
  IAsyncEventHandler,
  IAsyncServerEventMap,
  // Shared types from @synnel/types
  MessageId,
  ClientId,
  SubscriberId,
  ChannelName,
  Timestamp,
  DataPayload,
  ConnectionStatus,
  TransportConfig,
  MessageQueueOptions,
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
  ErrorData,
  MessageType,
  SignalType,
  ErrorCode,
} from './types/index.js'
