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
  MiddlewareManager,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware'
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
export { WebSocketServerTransport } from './transport'
export { BaseChannel, BroadcastTransport, MulticastTransport } from './channel'

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
} from './config'

export {
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
  DEFAULT_MAX_SUBSCRIBERS,
  DEFAULT_HISTORY_SIZE,
} from './config'

export { ClientRegistry } from './registry'

export { ConnectionHandler, MessageHandler, SignalHandler } from './handlers'

export type {
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
  IClientConnection,
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
  IPublishOptions,
  IBaseTransport,
  IHttpServer,
  IServerTransportConfig,
  IServerTransport,
  IClientData,
  IServerClient,
  IClientRegistry,
  IClientWithMetadata,
  IDisconnectionEvent,
  IChannelState,
  IChannelOptions,
  IMessageHistory,
  IChannelTransport,
  IBroadcastTransport,
  IMulticastTransport,
  IInternalChannelState,
  IMessageBusOptions,
  IMiddlewareAction,
  IMiddlewareContext,
  IMiddleware,
  IMiddlewareManager,
  IMiddlewareRejectionError,
  IMiddlewareContextFactory,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
  IServerConfig,
  IDefaultServerConfig,
  IServerConfigWithDefaults,
  IPartialServerConfig,
  IServerStats,
  ISynnelServer,
  IServerEventType,
  IServerEventMap,
  IEventHandler,
  IEventDataType,
  IEventUnsubscriber,
  IEventEmitter,
  IEventListenerStorage,
  IAsyncEventHandler,
  IAsyncServerEventMap,
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
} from './types'
