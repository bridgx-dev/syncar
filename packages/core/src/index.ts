/**
 * @synnel/core
 *
 * Platform-agnostic core for Synnel real-time synchronization
 *
 * @example
 * ```ts
 * import { MessageBus, Channel, createDataMessage } from '@synnel/core'
 *
 * const bus = new MessageBus()
 * const channel = bus.createChannel('chat')
 * bus.subscribe('chat', 'client-1')
 *
 * const message = createDataMessage('chat', { text: 'Hello' })
 * bus.publish('chat', message, 'client-1')
 * ```
 */

// Types
export type {
  ConnectionStatus,
  SubscriberId,
  ChannelName,
  MessageId,
  Timestamp,
  DataPayload,
  TransportConfig,
  ChannelState,
  SubscriptionState,
  MessageQueueOptions,
} from './types.js'

// Protocol
export {
  MessageType,
  SignalType,
  ErrorCode,
  type Message,
  type DataMessage,
  type SignalMessage,
  type ErrorMessage,
  type AckMessage,
  type ErrorData,
  isDataMessage,
  isSignalMessage,
  isErrorMessage,
  isAckMessage,
  generateMessageId,
  createDataMessage,
  createSignalMessage,
  createErrorMessage,
} from './protocol.js'

// Channel
export { Channel, type ChannelOptions } from './channel.js'

// MessageBus
export {
  MessageBus,
  type MessageHandler,
  type MessageBusOptions,
} from './message-bus.js'

export {
  type Transport,
  type TransportEventMap,
  type TransportCloseEvent,
  WebSocketClientTransport,
} from './ws-client.js'
