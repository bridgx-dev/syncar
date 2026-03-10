/**
 * Connection and transport related types
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
