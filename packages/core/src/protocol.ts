/**
 * Message protocol definitions
 * Defines the message types and structures used for communication
 */

import type { DataPayload, MessageId, Timestamp, ChannelName } from './types.js'

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
 * Base message interface
 */
export interface Message<T = unknown> {
  /** Unique message identifier */
  id: MessageId
  /** Message type */
  type: MessageType
  /** Channel name (optional for system-wide messages) */
  channel?: ChannelName
  /** Message payload */
  data?: DataPayload<T>
  /** Signal type (only for SIGNAL messages) */
  signal?: SignalType
  /** Message timestamp */
  timestamp: Timestamp
}

/**
 * Data message (typed message with channel)
 */
export interface DataMessage<T = unknown> extends Message<T> {
  type: MessageType.DATA
  channel: ChannelName
  data: T
}

/**
 * Signal message (control message)
 */
export interface SignalMessage extends Message {
  type: MessageType.SIGNAL
  channel: ChannelName
  signal: SignalType
  data?: DataPayload
}

/**
 * Error message
 */
export interface ErrorMessage extends Message {
  type: MessageType.ERROR
  channel?: ChannelName
  data: ErrorData
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
 * Acknowledgment message
 */
export interface AckMessage extends Message {
  type: MessageType.ACK
  /** Original message being acknowledged */
  ackMessageId: MessageId
}

/**
 * Guard to check if message is a DataMessage
 */
export function isDataMessage<T = unknown>(
  message: Message<T>,
): message is DataMessage<T> {
  return message.type === MessageType.DATA
}

/**
 * Guard to check if message is a SignalMessage
 */
export function isSignalMessage(message: Message): message is SignalMessage {
  return message.type === MessageType.SIGNAL
}

/**
 * Guard to check if message is an ErrorMessage
 */
export function isErrorMessage(message: Message): message is ErrorMessage {
  return message.type === MessageType.ERROR
}

/**
 * Guard to check if message is an AckMessage
 */
export function isAckMessage(message: Message): message is AckMessage {
  return message.type === MessageType.ACK
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): MessageId {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Create a data message
 */
export function createDataMessage<T>(
  channel: ChannelName,
  data: T,
  id?: MessageId,
): DataMessage<T> {
  return {
    id: id || generateMessageId(),
    type: MessageType.DATA,
    channel,
    data,
    timestamp: Date.now(),
  }
}

/**
 * Create a signal message
 */
export function createSignalMessage(
  channel: ChannelName,
  signal: SignalType,
  data?: DataPayload,
  id?: MessageId,
): SignalMessage {
  return {
    id: id || generateMessageId(),
    type: MessageType.SIGNAL,
    channel,
    signal,
    data,
    timestamp: Date.now(),
  }
}

/**
 * Create an error message
 */
export function createErrorMessage(
  message: string,
  code?: ErrorCode,
  channel?: ChannelName,
  id?: MessageId,
): ErrorMessage {
  return {
    id: id || generateMessageId(),
    type: MessageType.ERROR,
    channel,
    data: {
      message,
      code,
    },
    timestamp: Date.now(),
  }
}
