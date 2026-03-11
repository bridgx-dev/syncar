import type WebSocket from 'ws'
import type { IncomingMessage } from 'node:http'

/**
 * Message identifier
 */
export type MessageId = string

/**
 * Client identifier (e.g., WebSocket connection ID)
 */
export type ClientId = string

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

/**
 * Log levels
 *
 * @remarks
 * Standard log levels for the logger interface. Used to categorize
 * log messages by severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger interface
 *
 * @example
 * ```ts
 * const logger: ILogger = {
 *   debug: (msg, ...args) => console.debug(msg, ...args),
 *   info: (msg, ...args) => console.info(msg, ...args),
 *   warn: (msg, ...args) => console.warn(msg, ...args),
 *   error: (msg, ...args) => console.error(msg, ...args),
 * }
 * ```
 */
export interface ILogger {
    /**
     * Log a debug message
     *
     * @param message - The log message
     * @param args - Additional arguments to log
     */
    debug(message: string, ...args: unknown[]): void
    /**
     * Log an info message
     *
     * @param message - The log message
     * @param args - Additional arguments to log
     */
    info(message: string, ...args: unknown[]): void
    /**
     * Log a warning message
     *
     * @param message - The log message
     * @param args - Additional arguments to log
     */
    warn(message: string, ...args: unknown[]): void
    /**
     * Log an error message
     *
     * @param message - The log message
     * @param args - Additional arguments to log
     */
    error(message: string, ...args: unknown[]): void
}

/**
 * ID Generator function type
 * @param request - The incoming HTTP upgrade request
 */
export type IdGenerator = (
    request: IncomingMessage,
) => ClientId | Promise<ClientId>

// ============================================================
// BASE TYPES
// ============================================================

/**
 * Base client connection interface
 *
 * @remarks
 * Represents a connected WebSocket client with metadata about the connection.
 * This interface is used throughout the server for client tracking and management.
 *
 * @property id - Unique client identifier
 * @property connectedAt - Unix timestamp (ms) when the client connected
 * @property lastPingAt - Unix timestamp (ms) of the last ping/pong (optional)
 * @property socket - The raw WebSocket instance
 *
 * @example
 * ```ts
 * const client: IClientConnection = {
 *   id: 'client_123abc',
 *   connectedAt: 1699123456789,
 *   lastPingAt: 1699123459999,
 *   socket: wsSocket
 * }
 *
 * console.log(`Client ${client.id} connected at ${new Date(client.connectedAt).toLocaleString()}`)
 * ```
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
 *
 * @remarks
 * Enum defining all message types supported by the Syncar protocol.
 *
 * @see {@link SignalType} for signal message subtypes
 */
export enum MessageType {
    /** Data message - carries application data */
    DATA = 'data',
    /** Signal message - control message for subscriptions, pings, etc. */
    SIGNAL = 'signal',
    /** Error message - reports errors to clients */
    ERROR = 'error',
    /** Acknowledgment message - confirms message receipt */
    ACK = 'ack',
}

/**
 * Signal types for control messages
 *
 * @remarks
 * Enum defining all signal types used for protocol control operations.
 *
 * @example
 * ```ts
 * if (message.type === MessageType.SIGNAL) {
 *   if (message.signal === SignalType.SUBSCRIBE) {
 *     // Handle subscription
 *   } else if (message.signal === SignalType.PING) {
 *     // Respond with pong
 *   }
 * }
 * ```
 */
export enum SignalType {
    /** Subscribe to a channel */
    SUBSCRIBE = 'subscribe',
    /** Unsubscribe from a channel */
    UNSUBSCRIBE = 'unsubscribe',
    /** Ping message for keep-alive */
    PING = 'ping',
    /** Pong response to ping */
    PONG = 'pong',
    /** Confirmation of successful subscription */
    SUBSCRIBED = 'subscribed',
    /** Confirmation of successful unsubscription */
    UNSUBSCRIBED = 'unsubscribed',
}

/**
 * Standard error codes for messages
 *
 * @remarks
 * Enum defining error codes used in error messages sent to clients.
 */
export enum ErrorCode {
    /** Invalid message type */
    INVALID_MESSAGE_TYPE = 'INVALID_MESSAGE_TYPE',
    /** Channel name missing from message */
    MISSING_CHANNEL = 'MISSING_CHANNEL',
    /** Unknown signal type */
    UNKNOWN_SIGNAL = 'UNKNOWN_SIGNAL',
    /** Channel not found */
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    /** Reserved channel name (starts with __) */
    RESERVED_CHANNEL_NAME = 'RESERVED_CHANNEL_NAME',
    /** Invalid message format */
    INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
    /** Rate limit exceeded */
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/**
 * Base message interface
 *
 * @remarks
 * All messages in the Syncar protocol extend this interface with
 * common fields like ID, timestamp, and optional channel.
 *
 * @property id - Unique message identifier
 * @property timestamp - Unix timestamp (ms) when message was created
 * @property channel - Optional channel name (required for most message types)
 *
 * @example
 * ```ts
 * const baseMessage: BaseMessage = {
 *   id: generateId(),
 *   timestamp: Date.now(),
 *   channel: 'chat'
 * }
 * ```
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
 *
 * @remarks
 * Carries application data from sender to channel subscribers.
 * This is the primary message type for user-defined communication.
 *
 * @template T - Type of the data payload (default: unknown)
 *
 * @property type - Message type discriminator (always DATA)
 * @property channel - The target channel name
 * @property data - The message data payload
 *
 * @example
 * ```ts
 * const chatMessage: DataMessage<{ text: string; user: string }> = {
 *   id: generateId(),
 *   timestamp: Date.now(),
 *   type: MessageType.DATA,
 *   channel: 'chat',
 *   data: {
 *     text: 'Hello world!',
 *     user: 'Alice'
 *   }
 * }
 *
 * // Type narrowing
 * if (message.type === MessageType.DATA) {
 *   console.log(`${message.data.user}: ${message.data.text}`)
 * }
 * ```
 */
export interface DataMessage<T = unknown> extends BaseMessage {
    type: MessageType.DATA
    channel: ChannelName
    /** Message payload */
    data: T
}

/**
 * Signal message (control message)
 *
 * @remarks
 * Control messages for protocol operations like subscribe/unsubscribe,
 * ping/pong keep-alive, and subscription confirmations.
 *
 * @property type - Message type discriminator (always SIGNAL)
 * @property channel - The target channel name
 * @property signal - The signal type
 * @property data - Optional data payload
 *
 * @example
 * ### Subscribe signal
 * ```ts
 * const subscribeSignal: SignalMessage = {
 *   id: generateId(),
 *   timestamp: Date.now(),
 *   type: MessageType.SIGNAL,
 *   channel: 'chat',
 *   signal: SignalType.SUBSCRIBE
 * }
 * ```
 *
 * @example
 * ### Ping signal
 * ```ts
 * const pingSignal: SignalMessage = {
 *   id: generateId(),
 *   timestamp: Date.now(),
 *   type: MessageType.SIGNAL,
 *   signal: SignalType.PING
 * }
 * ```
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
 *
 * @remarks
 * Contains error information sent to clients when an error occurs.
 *
 * @property message - Human-readable error message
 * @property code - Optional machine-readable error code
 *
 * @example
 * ```ts
 * const errorData: ErrorData = {
 *   message: 'Channel not found',
 *   code: ErrorCode.CHANNEL_NOT_FOUND
 * }
 * ```
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
 *
 * @remarks
 * Sent to clients when an error occurs during message processing.
 *
 * @property type - Message type discriminator (always ERROR)
 * @property data - Error details including message and optional code
 *
 * @example
 * ```ts
 * const errorMessage: ErrorMessage = {
 *   id: generateId(),
 *   timestamp: Date.now(),
 *   type: MessageType.ERROR,
 *   data: {
 *     message: 'Channel not found',
 *     code: ErrorCode.CHANNEL_NOT_FOUND
 *   }
 * }
 * ```
 */
export interface ErrorMessage extends BaseMessage {
    type: MessageType.ERROR
    /** Error detail */
    data: ErrorData
}

/**
 * Acknowledgment message
 *
 * @remarks
 * Confirms receipt of a message. Used for reliable messaging patterns.
 *
 * @property type - Message type discriminator (always ACK)
 * @property ackMessageId - ID of the message being acknowledged
 *
 * @example
 * ```ts
 * const ackMessage: AckMessage = {
 *   id: generateId(),
 *   timestamp: Date.now(),
 *   type: MessageType.ACK,
 *   ackMessageId: 'original-message-id'
 * }
 * ```
 */
export interface AckMessage extends BaseMessage {
    type: MessageType.ACK
    /** Original message being acknowledged */
    ackMessageId: MessageId
}

/**
 * Union type for all supported messages in the protocol.
 *
 * @remarks
 * Discriminated union of all message types. Use type narrowing with
 * the `type` property to access specific message fields.
 *
 * @template T - Type of the data payload for DataMessage (default: unknown)
 *
 * @example
 * ```ts
 * function handleMessage(message: Message) {
 *   switch (message.type) {
 *     case MessageType.DATA:
 *       // message is DataMessage
 *       console.log('Data:', message.data)
 *       break
 *     case MessageType.SIGNAL:
 *       // message is SignalMessage
 *       console.log('Signal:', message.signal)
 *       break
 *     case MessageType.ERROR:
 *       // message is ErrorMessage
 *       console.error('Error:', message.data.message)
 *       break
 *     case MessageType.ACK:
 *       // message is AckMessage
 *       console.log('Ack for:', message.ackMessageId)
 *       break
 *   }
 * }
 * ```
 *
 * @example
 * ### Type narrowing with DataMessage generic
 * ```ts
 * interface ChatMessage {
 *   text: string
 *   user: string
 * }
 *
 * function isChatMessage(message: Message): message is DataMessage<ChatMessage> {
 *   return message.type === MessageType.DATA && message.channel === 'chat'
 * }
 *
 * if (isChatMessage(message)) {
 *   console.log(`${message.data.user}: ${message.data.text}`)
 * }
 * ```
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
 *
 * @remarks
 * Defines all actions that middleware can intercept and process.
 *
 * @example
 * ```ts
 * import type { IMiddlewareAction } from '@syncar/server'
 *
 * function handleAction(action: IMiddlewareAction) {
 *   switch (action) {
 *     case 'connect':
 *       console.log('Client connecting')
 *       break
 *     case 'disconnect':
 *       console.log('Client disconnecting')
 *       break
 *     case 'message':
 *       console.log('Message received')
 *       break
 *     case 'subscribe':
 *       console.log('Channel subscription')
 *       break
 *     case 'unsubscribe':
 *       console.log('Channel unsubscription')
 *       break
 *   }
 * }
 * ```
 */
export type IMiddlewareAction =
    | 'connect'
    | 'disconnect'
    | 'message'
    | 'subscribe'
    | 'unsubscribe'

/**
 * Next function type for middleware chain continuation
 *
 * @remarks
 * Function passed to middleware to continue execution to the next
 * middleware in the chain.
 *
 * @example
 * ```ts
 * const middleware: Middleware = async (context, next) => {
 *   // Pre-processing
 *   console.log('Before next')
 *
 *   // Continue to next middleware
 *   await next()
 *
 *   // Post-processing
 *   console.log('After next')
 * }
 * ```
 */
export type Next = () => Promise<void>

/**
 * Middleware context interface
 *
 * @remarks
 * Provides middleware functions with access to request information,
 * state management, and control flow methods. Inspired by Hono's context pattern.
 *
 * @template S - Type of the state object (default: Record<string, unknown>)
 *
 * @property req - Request information (client, message, channel, action)
 * @property error - Optional error object
 * @property finalized - Whether the context has been finalized
 * @property res - Optional response data
 * @property var - State object for storing custom data
 * @property get - Get a value from state by key
 * @property set - Set a value in state by key
 * @property reject - Reject the action with a reason (throws)
 *
 * @example
 * ### Basic usage
 * ```ts
 * const middleware: Middleware = async (context, next) => {
 *   console.log(`Action: ${context.req.action}`)
 *   console.log(`Client: ${context.req.client?.id}`)
 *   console.log(`Channel: ${context.req.channel}`)
 *
 *   await next()
 * }
 * ```
 *
 * @example
 * ### Using state
 * ```ts
 * interface MyState {
 *   user: { id: string; email: string }
 *   requestId: string
 * }
 *
 * const middleware: Middleware<MyState> = async (context, next) => {
 *   // Set state
 *   context.set('requestId', generateId())
 *
 *   // Get state
 *   const requestId = context.get('requestId')
 *
 *   await next()
 * }
 * ```
 *
 * @example
 * ### Rejecting actions
 * ```ts
 * const middleware: Middleware = async (context, next) => {
 *   if (context.req.action === 'connect') {
 *     // Check connection validity
 *     if (!isValidConnection(context.req.client)) {
 *       context.reject('Connection not allowed')
 *       // Function never returns (throws)
 *     }
 *   }
 *
 *   await next()
 * }
 * ```
 */
export interface IContext<S = Record<string, unknown>> {
    /** Request information */
    readonly req: {
        /** The client connection (if applicable) */
        readonly client?: IClientConnection
        /** The message being processed (if applicable) */
        readonly message?: Message
        /** The channel name (if applicable) */
        readonly channel?: ChannelName
        /** The action being performed */
        readonly action: IMiddlewareAction
    }
    /** Optional error object */
    error?: Error
    /** Whether the context has been finalized */
    finalized: boolean
    /** Optional response data */
    res?: unknown
    /** Get a value from state by key */
    get<K extends keyof S>(key: K): S[K]
    /** Set a value in state by key */
    set<K extends keyof S>(key: K, value: S[K]): void
    /** Reject the action with a reason (throws) */
    reject(reason: string): never
}

/**
 * Middleware function signature
 *
 * @remarks
 * Type definition for middleware functions. Middleware can be sync or async
 * and can return any value (though the return value is typically ignored).
 *
 * @template S - Type of the state object (default: Record<string, unknown>)
 *
 * @param c - The middleware context
 * @param next - Function to continue to the next middleware
 *
 * @example
 * ```ts
 * import type { Middleware } from '@syncar/server'
 *
 * const authMiddleware: Middleware = async (context, next) => {
 *   const token = context.req.message?.data?.token
 *
 *   if (!token) {
 *     context.reject('Authentication required')
 *   }
 *
 *   const user = await verifyToken(token)
 *   context.set('user', user)
 *
 *   await next()
 * }
 * ```
 *
 * @see {@link Context} for context interface
 * @see {@link IMiddlewareAction} for available actions
 */
export type IMiddleware<S = Record<string, unknown>> = (
    /** The middleware context */
    c: IContext<S>,
    /** Function to continue to the next middleware */
    next: Next,
) => void | Promise<void> | unknown

/**
 * Middleware rejection error interface
 *
 * @remarks
 * Interface for errors thrown when middleware rejects an action using
 * `context.reject()`. This is a standard interface - actual errors should
 * use the `MiddlewareRejectionError` class from the errors module.
 *
 * @property reason - Human-readable reason for rejection
 * @property action - The action that was rejected
 * @property name - Fixed value 'MiddlewareRejectionError' for interface compliance
 *
 * @example
 * ```ts
 * function isRejectionError(error: unknown): error is IMiddlewareRejectionError {
 *   return (
 *     typeof error === 'object' &&
 *     error !== null &&
 *     'name' in error &&
 *     error.name === 'MiddlewareRejectionError'
 *   )
 * }
 *
 * try {
 *   await someOperation()
 * } catch (error) {
 *   if (isRejectionError(error)) {
 *     console.error(`Action '${error.action}' rejected: ${error.reason}`)
 *   }
 * }
 * ```
 */
export interface IMiddlewareRejectionError {
    /** Human-readable reason for rejection */
    reason: string
    /** The action that was rejected */
    action: string
    /** Fixed value 'MiddlewareRejectionError' for interface compliance */
    name: 'MiddlewareRejectionError'
}
