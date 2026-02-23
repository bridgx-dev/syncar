/**
 * @synnel/types
 *
 * Internal shared types for Synnel real-time synchronization
 * This package is private and should NOT be published to npm.
 *
 * @example
 * ```ts
 * import type { Message, ChannelName, ConnectionStatus } from '@synnel/types'
 * ```
 */

// Common types
export type {
  MessageId,
  ClientId,
  SubscriberId,
  ChannelName,
  Timestamp,
  DataPayload,
} from './common.js'

// Connection types
export type {
  ConnectionStatus,
  TransportConfig,
  MessageQueueOptions,
} from './connection.js'

// Channel types
export type {
  ChannelState,
  SubscriptionState as ChannelSubscriptionState,
  ChannelOptions,
  MessageBusOptions,
} from './channel.js'

// Message types
export type {
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
  ErrorData,
  MessageHandler,
} from './message.js'

export { MessageType, SignalType, ErrorCode } from './message.js'

// Client types
export type {
  ClientStatus,
  Transport,
  ClientConfig,
  SubscriptionState,
  SubscribeOptions,
  SubscriptionCallbacks,
  ChannelSubscription,
  ClientEventType,
  ClientEventMap,
  ClientStats,
  MessageFilter,
  ClientMessageHandler,
} from './client.js'
