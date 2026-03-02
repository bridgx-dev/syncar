/**
 * Core type definitions for Synnel
 * Platform-agnostic interfaces used across all packages
 */

/**
 * Connection status for both client and server
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'

/**
 * Subscriber identifier (typically client ID)
 */
export type SubscriberId = string

/** Client identifier (e.g., WebSocket connection ID) */
export type ClientId = string

/**
 * Channel name
 */
export type ChannelName = string

/**
 * Message identifier
 */
export type MessageId = string

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number

/**
 * Generic data payload for messages
 */
export type DataPayload<T = unknown> = T

/**
 * Transport configuration options
 */
export interface TransportConfig {
  /**
   * WebSocket URL (e.g., ws://localhost:3000 or wss://example.com)
   */
  url?: string

  /**
   * Enable automatic reconnection
   * @default true
   */
  reconnect?: boolean

  /**
   * Initial delay before first reconnection attempt (ms)
   * @default 1000
   */
  reconnectDelay?: number

  /**
   * Maximum number of reconnection attempts
   * @default Infinity
   */
  maxReconnectAttempts?: number

  /**
   * Maximum reconnection delay (ms)
   * @default 30000
   */
  maxReconnectDelay?: number

  /**
   * Backoff multiplier for exponential backoff
   * @default 1.5
   */
  reconnectBackoffFactor?: number
}

/**
 * Channel state information
 */
export interface ChannelState<T = unknown> {
  name: ChannelName
  subscriberCount: number
  createdAt: Timestamp
  lastMessageAt?: Timestamp
}

/**
 * Subscription state
 */
export interface SubscriptionState {
  id: string
  channel: ChannelName
  subscriber: SubscriberId
  active: boolean
  subscribedAt: Timestamp
}

/**
 * Message queue options
 */
export interface MessageQueueOptions {
  /**
   * Maximum queue size (0 = unlimited)
   * @default 100
   */
  maxSize?: number

  /**
   * Whether to drop oldest messages when queue is full
   * @default true
   */
  dropOldest?: boolean
}
