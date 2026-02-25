/**
 * Handlers Module
 * Message and connection handlers for processing client actions.
 *
 * @module handlers
 */

// ============================================================
// CONNECTION HANDLER
// ============================================================

export {
  ConnectionHandler,
} from './connection-handler.js'

export type {
  ConnectionHandlerOptions,
} from './connection-handler.js'

// ============================================================
// MESSAGE HANDLER
// ============================================================

export {
  MessageHandler,
} from './message-handler.js'

export type {
  MessageHandlerOptions,
} from './message-handler.js'

// ============================================================
// SIGNAL HANDLER
// ============================================================

export {
  SignalHandler,
} from './signal-handler.js'

export type {
  SignalHandlerOptions,
} from './signal-handler.js'

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IClientRegistry,
  IServerClient,
} from '../types/client.js'

export type { IClientConnection } from '../types/base.js'

export type { IMiddlewareManager } from '../types/middleware.js'

export type { IEventEmitter } from '../types/events.js'

export type {
  IServerEventMap,
  IEventHandler,
  IEventDataType,
  IEventUnsubscriber,
} from '../types/events.js'

export type { IChannel, IMessageHandler, ILifecycleHandler } from '../types/base.js'

export type { IServerTransport } from '../types/transport.js'

export type {
  IChannelTransport,
  IChannelOptions,
  IChannelState,
} from '../types/channel.js'

export type {
  DataMessage,
  SignalMessage,
  SignalType,
  ChannelName,
  Message,
} from '@synnel/types'
