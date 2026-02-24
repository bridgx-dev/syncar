/**
 * Server Module
 * Main server class and factory for real-time WebSocket communication.
 *
 * @module server
 */

// ============================================================
// SYNEL SERVER
// ============================================================

export {
  SynnelServer,
} from './synnel-server.js'

// ============================================================
// SERVER FACTORY
// ============================================================

export {
  createSynnelServer,
} from './factory.js'

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IServerConfig,
  ISynnelServer,
  IServerStats,
  IDefaultServerConfig,
  IServerConfigWithDefaults,
  IPartialServerConfig,
} from '../types/server.js'

export type { IServerTransport } from '../types/transport.js'

export type {
  IClientRegistry,
  IServerClient,
  IClientData,
} from '../types/client.js'

export type { IMiddlewareManager } from '../types/middleware.js'

export type { IEventEmitter } from '../types/events.js'

export type {
  IServerEventMap,
  IServerEventType,
  IEventHandler,
  IEventDataType,
  IEventUnsubscriber,
} from '../types/events.js'

export type {
  IChannel,
  IMessageHandler,
  ILifecycleHandler,
} from '../types/base.js'

export type {
  IBroadcastTransport,
  IMulticastTransport,
  IChannelTransport,
  IChannelOptions,
  IChannelState,
} from '../types/channel.js'

export type {
  ChannelName,
  Message,
  DataMessage,
  SignalMessage,
} from '@synnel/types'
