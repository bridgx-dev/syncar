/**
 * Client Types
 * Framework-agnostic client types for Synnel v2
 */

import type {
  ChannelName,
  Message,
  MessageType,
  DataMessage,
  SubscriberId,
} from '@synnel/core'

/**
 * Client connection status
 */
export type ClientStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'reconnecting'

/**
 * Transport interface - must be implemented by any transport adapter
 */
export interface Transport {
  /**
   * Current transport status
   */
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting'

  /**
   * Connect to the server
   */
  connect(): Promise<void>

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>

  /**
   * Send a message
   */
  send(message: Message): Promise<void>

  /**
   * Register an event handler
   */
  on(
    event: 'open' | 'message' | 'error' | 'close',
    handler: (...args: any[]) => void,
  ): () => void

  /**
   * Get connection info
   */
  getConnectionInfo?(): { connectedAt?: number; url?: string }
}

/**
 * Client configuration
 */
export interface ClientConfig {
  /**
   * Transport implementation (WebSocket, SSE, etc.)
   */
  transport: Transport

  /**
   * Unique identifier for this client
   * If not provided, one will be generated
   */
  id?: SubscriberId

  /**
   * Auto-connect on initialization
   * @default false
   */
  autoConnect?: boolean

  /**
   * Auto-reconnect on disconnect
   * @default true
   */
  autoReconnect?: boolean

  /**
   * Maximum reconnection attempts
   * @default 10
   */
  maxReconnectAttempts?: number

  /**
   * Initial reconnection delay in ms
   * @default 1000
   */
  reconnectDelay?: number

  /**
   * Maximum reconnection delay in ms
   * @default 30000
   */
  maxReconnectDelay?: number

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean

  /**
   * Logger function
   */
  logger?: (
    level: 'info' | 'warn' | 'error',
    message: string,
    ...args: any[]
  ) => void
}

/**
 * Channel subscription state
 */
export type SubscriptionState =
  | 'unsubscribed'
  | 'subscribing'
  | 'subscribed'
  | 'unsubscribing'

/**
 * Channel subscription options
 */
export interface SubscribeOptions {
  /**
   * Auto-reconnect to channel after reconnection
   * @default true
   */
  autoResubscribe?: boolean

  /**
   * Data to send with subscribe message
   */
  data?: unknown
}

/**
 * Channel subscription callbacks
 */
export interface SubscriptionCallbacks<T = unknown> {
  /**
   * Called when a data message is received
   */
  onMessage?: (message: DataMessage<T>) => void

  /**
   * Called when subscription is confirmed
   */
  onSubscribed?: () => void

  /**
   * Called when unsubscription is confirmed
   */
  onUnsubscribed?: () => void

  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void
}

/**
 * Channel subscription
 */
export interface ChannelSubscription<T = unknown> {
  /**
   * Channel name
   */
  readonly channel: ChannelName

  /**
   * Current subscription state
   */
  readonly state: SubscriptionState

  /**
   * Whether auto-resubscribe is enabled
   */
  readonly autoResubscribe: boolean

  /**
   * Subscribe to the channel
   */
  subscribe(options?: SubscribeOptions): Promise<void>

  /**
   * Unsubscribe from the channel
   */
  unsubscribe(): Promise<void>

  /**
   * Update message handlers
   */
  onMessage(handler: (message: DataMessage<T>) => void): () => void

  /**
   * Get subscription info
   */
  getInfo(): {
    channel: ChannelName
    state: SubscriptionState
    autoResubscribe: boolean
    subscribedAt?: number
  }
}

/**
 * Client event types
 */
export type ClientEventType =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'message'

/**
 * Client event map
 */
export interface ClientEventMap {
  connecting: () => void
  connected: () => void
  disconnected: (event?: { code?: number; reason?: string }) => void
  reconnecting: (attempt: number) => void
  error: (error: Error) => void
  message: (message: Message) => void
}

/**
 * Client statistics
 */
export interface ClientStats {
  /**
   * Current connection status
   */
  status: ClientStatus

  /**
   * Client ID
   */
  id: string

  /**
   * Number of active channel subscriptions
   */
  subscriptions: number

  /**
   * Total messages received
   */
  messagesReceived: number

  /**
   * Total messages sent
   */
  messagesSent: number

  /**
   * Number of reconnection attempts
   */
  reconnectAttempts: number

  /**
   * Connection timestamp
   */
  connectedAt?: number

  /**
   * List of subscribed channels
   */
  channels: ChannelName[]
}

/**
 * Message filter function
 */
export type MessageFilter = (message: Message) => boolean

/**
 * Message handler function
 */
export type MessageHandler<T = unknown> = (message: DataMessage<T>) => void
