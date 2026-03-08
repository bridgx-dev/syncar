import type WebSocket from 'ws'

// ============================================================
// COMMON TYPES
// ============================================================

/**
 * Message identifier
 */
export type MessageId = string

/**
 * Client identifier (e.g., WebSocket connection ID)
 */
export type ClientId = string

/**
 * Subscriber identifier (typically client ID)
 */
export type SubscriberId = string

/**
 * Channel name
 */
export type ChannelName = string

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number

/**
 * Generic data payload for messages
 */
export type DataPayload<T = unknown> = T

// ============================================================
// BASE TYPES
// ============================================================

/**
 * Base client connection interface
 */
export interface IClientConnection {
    /** Unique client identifier */
    readonly id: ClientId

    /** Connected timestamp */
    readonly connectedAt: Timestamp

    /** Last ping timestamp */
    lastPingAt?: Timestamp

    /** Raw WebSocket instance */
    readonly socket: WebSocket
}

// ============================================================
// MESSAGE TYPES
// ============================================================

/**
 * Message types for protocol communication
 */
export enum MessageType {
    DATA = 'data',
    SIGNAL = 'signal',
    ERROR = 'error',
    ACK = 'ack',
}

/**
 * Signal types for control messages
 */
export enum SignalType {
    SUBSCRIBE = 'subscribe',
    UNSUBSCRIBE = 'unsubscribe',
    PING = 'ping',
    PONG = 'pong',
    SUBSCRIBED = 'subscribed',
    UNSUBSCRIBED = 'unsubscribed',
}

/**
 * Standard error codes for messages
 */
export enum ErrorCode {
    INVALID_MESSAGE_TYPE = 'INVALID_MESSAGE_TYPE',
    MISSING_CHANNEL = 'MISSING_CHANNEL',
    UNKNOWN_SIGNAL = 'UNKNOWN_SIGNAL',
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    RESERVED_CHANNEL_NAME = 'RESERVED_CHANNEL_NAME',
    INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
    ID_REQUIRED = 'ID_REQUIRED',
    ID_TAKEN = 'ID_TAKEN',
    INVALID_ID_FORMAT = 'INVALID_ID_FORMAT',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Base message interface
 */
export interface BaseMessage {
    /** Unique message identifier */
    id: MessageId
    /** Message timestamp */
    timestamp: Timestamp
    /** Channel name */
    channel?: ChannelName
}

/**
 * Data message (typed message with channel)
 */
export interface DataMessage<T = unknown> extends BaseMessage {
    type: MessageType.DATA
    channel: ChannelName
    /** Message payload */
    data: T
}

/**
 * Signal message (control message)
 */
export interface SignalMessage extends BaseMessage {
    type: MessageType.SIGNAL
    channel: ChannelName
    /** Signal type */
    signal: SignalType
    /** Message payload */
    data?: DataPayload
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
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR
    /** Error detail */
    data: ErrorData
}

/**
 * Acknowledgment message
 */
export interface AckMessage extends BaseMessage {
    type: MessageType.ACK
    /** Original message being acknowledged */
    ackMessageId: MessageId
}

/**
 * Union type for all supported messages in the protocol.
 */
export type Message<T = unknown> =
    | DataMessage<T>
    | SignalMessage
    | ErrorMessage
    | AckMessage

// ============================================================
// MIDDLEWARE TYPES
// ============================================================

/**
 * Middleware action types
 */
export type IMiddlewareAction =
    | 'connect'
    | 'disconnect'
    | 'message'
    | 'subscribe'
    | 'unsubscribe'

export type Next = () => Promise<any>

/**
 * Middleware context interface
 */
export interface Context<S = Record<string, any>> {
    readonly req: {
        readonly client?: IClientConnection
        readonly message?: Message
        readonly channel?: ChannelName
        readonly action: IMiddlewareAction
    }
    error?: Error
    finalized: boolean
    res?: any
    readonly var: S
    get<K extends keyof S>(key: K): S[K]
    set<K extends keyof S>(key: K, value: S[K]): void
    reject(reason: string): never
}

/**
 * Middleware function signature
 */
export type Middleware<S = any> = (
    c: Context<S>,
    next: Next,
) => any | Promise<any>

// Aliases
export type IMiddleware<S = any> = Middleware<S>
export type IMiddlewareContext<S = any> = Context<S>

/**
 * Middleware rejection error interface
 */
export interface IMiddlewareRejectionError {
    reason: string
    action: string
    name: 'MiddlewareRejectionError'
}
