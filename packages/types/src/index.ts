/**
 * @synnel/types
 *
 * Shared types for Synnel real-time synchronization
 * This package contains only shared/common types used across all packages.
 *
 * Package-specific types are in their respective packages:
 * - Client types: @synnel/client
 * - Server types: @synnel/server
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
