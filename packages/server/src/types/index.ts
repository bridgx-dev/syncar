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
 *   IClientRegistry,
 *   IChannelTransport,
 *   IMiddleware
 * } from './types'
 * ```
 */

// ============================================================
// UTILITY TYPES
// ============================================================
// Re-exported from utilities for convenience
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
} from './utilities'

// ============================================================
// BASE TYPES (Single Source of Truth)
// ============================================================
export type {
  IClientConnection,
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
  IPublishOptions,
} from './base'

// ============================================================
// TRANSPORT TYPES
// ============================================================
export type {
  IBaseTransport,
  IHttpServer,
  IServerTransportConfig,
  IServerTransport,
} from './transport'

// ============================================================
// CLIENT TYPES
// ============================================================
export type { IDisconnectionEvent } from './client'
export { ClientRegistry } from '../registry'

// ============================================================
// CHANNEL TYPES
// ============================================================
export type {
  IChannelState,
  IChannelTransport,
  IBroadcastTransport,
  IMulticastTransport,
} from './channel'
export type { BaseChannel, BroadcastChannel, MulticastChannel } from './channel'

// ============================================================
// MIDDLEWARE TYPES
// ============================================================
export type {
  IMiddlewareAction,
  Context,
  Middleware,
  IMiddlewareAction as Action,
  IMiddleware,
  Next,
  IMiddlewareRejectionError,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
} from './middleware'
export { ContextManager } from '../context'

// ============================================================
// SERVER CONFIG TYPES
// ============================================================
export type {
  IServerConfig,
  IServerOptions,
  IDefaultServerConfig,
  IPartialServerConfig,
  IServerStats,
} from './server'

// ============================================================
// HANDLER TYPES
// ============================================================
export type {
  MessageHandler,
  MessageHandlerOptions,
  SignalHandler,
  SignalHandlerOptions,
  ConnectionHandler,
  ConnectionHandlerOptions,
} from './handlers'


// ============================================================
// RE-EXPORT SHARED TYPES
// ============================================================
/**
 * Common shared types
 * Re-exported here for convenience
 */
export type {
  MessageId,
  ClientId,
  SubscriberId,
  ChannelName,
  Timestamp,
  DataPayload,
} from './common'
export type {
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
  ErrorData,
} from './message'
export { MessageType, SignalType, ErrorCode } from './message'
