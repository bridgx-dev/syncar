/**
 * Message protocol definitions
 * Defines the message types and structures used for communication
 */

import type {
  DataPayload,
  MessageId,
  Timestamp,
  ChannelName,
} from './common.js'

/**
 * Message types for protocol communication
 */
export enum MessageType {
  /** Regular data message */
  DATA = 'data',
  /** Control signal (subscribe, unsubscribe, etc.) */
  SIGNAL = 'signal',
  /** Error message */
  ERROR = 'error',
  /** Acknowledgment */
  ACK = 'ack',
}

/**
 * Signal types for control messages
 */
export enum SignalType {
  /** Subscribe to a channel */
  SUBSCRIBE = 'subscribe',
  /** Unsubscribe from a channel */
  UNSUBSCRIBE = 'unsubscribe',
  /** Ping for keep-alive */
  PING = 'ping',
  /** Pong response to ping */
  PONG = 'pong',
  /** Subscription successful */
  SUBSCRIBED = 'subscribed',
  /** Unsubscription successful */
  UNSUBSCRIBED = 'unsubscribed',
}

/**
 * Standard error codes
 */
export enum ErrorCode {
  /** Message type is invalid/unknown */
  INVALID_MESSAGE_TYPE = 'INVALID_MESSAGE_TYPE',
  /** Channel name is missing */
  MISSING_CHANNEL = 'MISSING_CHANNEL',
  /** Unknown signal type */
  UNKNOWN_SIGNAL = 'UNKNOWN_SIGNAL',
  /** Channel not found */
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  /** Reserved channel name */
  RESERVED_CHANNEL_NAME = 'RESERVED_CHANNEL_NAME',
  /** Invalid message format */
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  /** Client ID required */
  ID_REQUIRED = 'ID_REQUIRED',
  /** Client ID already taken */
  ID_TAKEN = 'ID_TAKEN',
  /** Invalid client ID format */
  INVALID_ID_FORMAT = 'INVALID_ID_FORMAT',
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Base message interface
 */
export interface BaseMessage {
  /** Unique message identifier */
  id: MessageId
  /** Message timestamp */
  timestamp: Timestamp
  /** Channel name (optional for system-wide messages) */
  channel?: ChannelName
}

/**
 * Data message (typed message with channel)
 */
export interface DataMessage<T = unknown> extends BaseMessage {
  /** Message type */
  type: MessageType.DATA
  channel: ChannelName
  /** Message payload */
  data: T
}

/**
 * Signal message (control message)
 */
export interface SignalMessage extends BaseMessage {
  /** Message type */
  type: MessageType.SIGNAL
  channel: ChannelName
  /** Signal type (only for SIGNAL messages) */
  signal: SignalType
  /** Message payload */
  data?: DataPayload
}

/**
 * Error data structure
 */
export interface ErrorData {
  /** Human-readable error message */
  message: string
  /** Machine-readable error code */
  code?: ErrorCode
  /** Additional error context */
  [key: string]: unknown
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  /** Message type */
  type: MessageType.ERROR
  /** Error detail */
  data: ErrorData
}

/**
 * Acknowledgment message
 */
export interface AckMessage extends BaseMessage {
  /** Message type */
  type: MessageType.ACK
  /** Original message being acknowledged */
  ackMessageId: MessageId
}

/**
 * Union type for all supported messages in the protocol.
 * Resolves to the specific message interface based on the `type` property.
 */
export type Message<T = unknown> =
  | DataMessage<T>
  | SignalMessage
  | ErrorMessage
  | AckMessage
