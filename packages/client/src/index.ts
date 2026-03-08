/**
 * @syncar/client
 *
 * Framework-agnostic client for Syncar real-time synchronization
 *
 * @example
 * ```ts
 * import { createSyncarClient, WebSocketClientTransport } from '@syncar/client'
 *
 * const transport = new WebSocketClientTransport({
 *   url: 'ws://localhost:3000',
 *   reconnect: true,
 * })
 *
 * const client = createSyncarClient({
 *   id: 'my-app',
 *   transport,
 *   autoConnect: false,
 *   autoReconnect: true,
 * })
 *
 * await client.connect()
 *
 * // Subscribe to a channel
 * await client.subscribe('chat', {
 *   onMessage: (msg) => console.log('Received:', msg.data),
 *   onSubscribed: () => console.log('Subscribed!'),
 * })
 *
 * // Publish a message
 * await client.publish('chat', { text: 'Hello!' })
 * ```
 */

// Main client
export { SyncarClient, createSyncarClient } from './client.js'

// Connection manager
export { ConnectionManager } from './connection-manager.js'

// Channel subscription
export { ChannelSubscriptionImpl } from './channel-subscription.js'

// Base WebSocket transport
export { WebSocketClientTransport } from './base.js'

// Types
export type {
  // Config
  ClientConfig,
  SubscribeOptions,
  SubscriptionCallbacks,

  // Core types (re-exported from @syncar/types)
  Transport,
  ClientStatus,
  SubscriptionState,
  ChannelName,

  // Events
  ClientEventType,
  ClientEventMap,

  // Interfaces
  ChannelSubscription,
  ClientMessageHandler as MessageHandler,
  MessageFilter,

  // Stats
  ClientStats,

  // Transport types
  ClientTransportConfig,
  TransportEventType,
  TransportEventMap,
  TransportCloseEvent,
  ConnectionStatus,

  // Message types (re-exported from @syncar/types)
  Message,
  DataMessage,
  MessageType,
  SignalType,
  SubscriberId,
} from './types.js'
