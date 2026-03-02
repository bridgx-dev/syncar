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
export type { IClientRegistry, IDisconnectionEvent } from './client'
export type { ClientRegistry } from './client'

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
  IMiddlewareContext,
  IMiddleware,
  IContextManager,
  Next,
  IMiddlewareRejectionError,
  IMiddlewareContextFactory,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
} from './middleware'
export type { ContextManager } from './middleware'

// ============================================================
// SERVER CONFIG TYPES
// ============================================================
export type {
  IServerConfig,
  IServerOptions,
  IDefaultServerConfig,
  IPartialServerConfig,
  IServerStats,
  ISynnelServer,
} from './server'
export type { SynnelServer } from './server'

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
