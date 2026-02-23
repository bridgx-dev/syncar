/**
 * @synnel/client
 *
 * Framework-agnostic client for Synnel real-time synchronization
 *
 * @example
 * ```ts
 * import { createSynnelClient, WebSocketClientTransport } from '@synnel/client'
 *
 * const transport = new WebSocketClientTransport({
 *   url: 'ws://localhost:3000',
 *   reconnect: true,
 * })
 *
 * const client = createSynnelClient({
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
export { SynnelClient, createSynnelClient } from './client.js'

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

  // Core types
  Transport,
  ClientStatus,
  SubscriptionState,

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
} from './types.js'
