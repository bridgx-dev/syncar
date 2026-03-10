/**
 * Client Types
 * Type definitions for the @syncar/client package
 */

import type {
    Message,
    DataMessage,
    ChannelName,
    SubscriberId,
    MessageType,
    SignalType,
} from '@syncar/types'

// Re-export common types from @syncar/types for convenience
export type {
    Message,
    DataMessage,
    ChannelName,
    SubscriberId,
    MessageType,
    SignalType,
}

// ============================================================
// TRANSPORT TYPES (from base.ts)
// ============================================================

/**
 * Transport event types
 */
export type TransportEventType = 'open' | 'close' | 'message' | 'error'

/**
 * Transport close event
 */
export interface TransportCloseEvent {
    wasClean: boolean
    code: number
    reason: string
}

/**
 * Transport event map
 */
export type TransportEventMap = {
    open: () => void
    close: (event: TransportCloseEvent) => void
    message: (message: Message) => void
    error: (error: Error) => void
}

/**
 * Transport interface - must be implemented by any transport adapter
 */
export interface Transport {
    /**
     * Current transport status
     */
    readonly status: ConnectionStatus

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
    on<E extends TransportEventType>(
        event: E,
        handler: TransportEventMap[E],
    ): () => void

    /**
     * Get connection info
     */
    getConnectionInfo?(): { connectedAt?: number; url?: string }
}

/**
 * Client transport configuration
 */
export interface ClientTransportConfig {
    /**
     * WebSocket URL
     */
    url: string

    /**
     * Enable automatic reconnection
     * @default false
     */
    reconnect?: boolean

    /**
     * Maximum reconnection attempts
     * @default 5
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
     * Connection timeout in ms
     * @default 10000
     */
    connectionTimeout?: number

    /**
     * Custom WebSocket constructor (for testing or custom implementations)
     */
    WebSocketConstructor?: unknown
}

// ============================================================
// CLIENT STATUS
// ============================================================

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
 * Connection status (shared with transport)
 */
export type ConnectionStatus =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'disconnecting'

// ============================================================
// CLIENT CONFIGURATION
// ============================================================

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
        ...args: unknown[]
    ) => void
}

// ============================================================
// CHANNEL SUBSCRIPTION TYPES
// ============================================================

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
 * Channel subscription interface
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

// ============================================================
// CLIENT EVENTS
// ============================================================

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

// ============================================================
// CLIENT STATISTICS
// ============================================================

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

// ============================================================
// UTILITY TYPES
// ============================================================

/**
 * Message filter function
 */
export type MessageFilter = (message: Message) => boolean

/**
 * Message handler function
 */
export type ClientMessageHandler<T = unknown> = (
    message: DataMessage<T>,
) => void
