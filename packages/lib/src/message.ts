/**
 * Message utilities
 * Type guards and factory functions for message protocol
 */

import type {
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
} from '@synnel/types'
import { MessageType } from '@synnel/types'
import type { ChannelName, MessageId, DataPayload } from '@synnel/types'
import { generateMessageId } from './id.js'

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
  signal: import('@synnel/types').SignalType,
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
  code?: import('@synnel/types').ErrorCode,
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

/**
 * Create an acknowledgment message
 */
export function createAckMessage(
  ackMessageId: MessageId,
  channel?: ChannelName,
  id?: MessageId,
): AckMessage {
  return {
    id: id || generateMessageId(),
    type: MessageType.ACK,
    channel,
    ackMessageId,
    timestamp: Date.now(),
  }
}
