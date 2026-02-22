/**
 * @synnel/client
 *
 * Framework-agnostic client for Synnel real-time synchronization
 *
 * @example
 * ```ts
 * import { createSynnelClient, createWebSocketClientTransport } from '@synnel/client'
 * import { createWebSocketClientTransport } from '@synnel/adapter-ws/client'
 *
 * const transport = createWebSocketClientTransport({
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
  MessageHandler,
  MessageFilter,

  // Stats
  ClientStats,
} from './types.js'
