/**
 * @synnel/server Types
 * Type definitions for the @synnel/server package.
 *
 * This module exports all type definitions organized by category.
 *
 * @example
 * ```ts
 * import type {
 *   ISynnelServer,
 *   IServerClient,
 *   IChannelTransport,
 *   IMiddleware,
 *   IClientWithMetadata
 * } from '@synnel/server/types'
 * ```
 */

// ============================================================
// UTILITY TYPES
// ============================================================
// Re-exported from @synnel/types for convenience
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
} from '@synnel/types'

// ============================================================
// BASE TYPES (Single Source of Truth)
// ============================================================
export type {
  IClientConnection,
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
  IPublishOptions,
} from './base.js'

// ============================================================
// TRANSPORT TYPES
// ============================================================
export type {
  IBaseTransport,
  IHttpServer,
  IServerTransportConfig,
  IServerTransport,
} from './transport.js'

// ============================================================
// CLIENT TYPES
// ============================================================
export type {
  IClientData,
  IServerClient,
  IClientRegistry,
  IClientWithMetadata,
  IDisconnectionEvent,
} from './client.js'

// ============================================================
// CHANNEL TYPES
// ============================================================
export type {
  IChannelState,
  IChannelOptions,
  IMessageHistory,
  IChannelTransport,
  IBroadcastTransport,
  IMulticastTransport,
  IInternalChannelState,
  IMessageBusOptions,
} from './channel.js'

// ============================================================
// MIDDLEWARE TYPES
// ============================================================
export type {
  IMiddlewareAction,
  IMiddlewareContext,
  IMiddleware,
  IMiddlewareManager,
  IMiddlewareRejectionError,
  IMiddlewareContextFactory,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
} from './middleware.js'

// ============================================================
// SERVER CONFIG TYPES
// ============================================================
export type {
  IServerConfig,
  IDefaultServerConfig,
  IServerConfigWithDefaults,
  IPartialServerConfig,
  IServerStats,
  ISynnelServer,
} from './server.js'

// ============================================================
// EVENT TYPES
// ============================================================
export type {
  IServerEventType,
  IServerEventMap,
  IEventHandler,
  IEventDataType,
  IEventUnsubscriber,
  IEventEmitter,
  IEventListenerStorage,
  IAsyncEventHandler,
  IAsyncServerEventMap,
} from './events.js'

// ============================================================
// RE-EXPORT SHARED TYPES FROM @synnel/types
// ============================================================
/**
 * Common shared types from @synnel/types
 * Re-exported here for convenience
 */
export type {
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
} from '@synnel/types'
