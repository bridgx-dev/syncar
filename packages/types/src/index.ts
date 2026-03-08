/**
 * @syncar/types
 *
 * Shared types for Syncar real-time synchronization
 * This package contains only shared/common types used across all packages.
 *
 * Package-specific types are in their respective packages:
 * - Client types: @syncar/client
 * - Server types: @syncar/server
 *
 * @example
 * ```ts
 * import type { Message, ChannelName, ConnectionStatus } from '@syncar/types'
 * import type { MergeTypes, DeepPartial } from '@syncar/types/utilities'
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

// Utility types
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
} from './utilities.js'
