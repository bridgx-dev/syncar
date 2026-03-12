/**
 * Errors Module
 * @description Custom error classes for the Syncar server.
 */

import type { IMiddlewareRejectionError, IMiddlewareAction } from './types'

// ============================================================
// BASE SYNNEL ERROR
// ============================================================

/**
 * Base Syncar error class
 * @example
 * ```ts
 * throw new SyncarError('Something went wrong', 'INTERNAL_ERROR')
 * ```
 */
export class SyncarError extends Error {
    /**
     * Error code for programmatic error handling
     *
     * @remarks
     * Machine-readable error code that can be used for conditional
     * error handling and error response generation.
     */
    public readonly code: string

    /**
     * Additional error context (optional)
     *
     * @remarks
     * Arbitrary data attached to the error for debugging or logging.
     * Common uses include user IDs, request IDs, or validation details.
     */
    public readonly context?: Record<string, unknown>

    /**
     * Creates a new SyncarError
     *
     * @param message - Human-readable error message
     * @param code - Error code for programmatic handling (default: 'SYNNEL_ERROR')
     * @param context - Optional additional error context
     */
    constructor(
        message: string,
        code: string = 'SYNNEL_ERROR',
        context?: Record<string, unknown>,
    ) {
        super(message)
        this.name = 'SyncarError'
        this.code = code
        this.context = context

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SyncarError)
        }
    }

    /**
     * Convert error to JSON for logging/serialization
     *
     * @returns JSON representation of the error
     *
     * @example
     * ```ts
     * const error = new SyncarError('Failed', 'FAIL', { id: 123 })
     * console.log(JSON.stringify(error.toJSON(), null, 2))
     * // {
     * //   "name": "SyncarError",
     * //   "message": "Failed",
     * //   "code": "FAIL",
     * //   "context": { "id": 123 },
     * //   "stack": "..."
     * // }
     * ```
     */
    toJSON(): {
        name: string
        message: string
        code: string
        context?: Record<string, unknown>
        stack?: string
    } {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            stack: this.stack,
        }
    }

    /**
     * Get a summary of the error for logging
     *
     * @returns Formatted error summary string
     *
     * @example
     * ```ts
     * const error = new SyncarError('Failed', 'FAIL')
     * console.log(error.toString())
     * // "[SyncarError:FAIL] Failed"
     * ```
     */
    override toString(): string {
        return `[${this.name}:${this.code}] ${this.message}`
    }
}

// ============================================================
// COMMON ERROR CLASSES
// ============================================================

/**
 * Configuration error
 *
 * @remarks
 * Thrown when server configuration is invalid or missing required values.
 *
 * @example
 * ```ts
 * if (!config.port) {
 *   throw new ConfigError('Port is required', { config })
 * }
 * ```
 */
export class ConfigError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CONFIG_ERROR', context)
        this.name = 'ConfigError'
    }
}

/**
 * Transport error
 *
 * @remarks
 * Thrown when the transport layer fails (WebSocket connection issues, etc.).
 *
 * @example
 * ```ts
 * if (!wsServer) {
 *   throw new TransportError('WebSocket server not initialized')
 * }
 * ```
 */
export class TransportError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'TRANSPORT_ERROR', context)
        this.name = 'TransportError'
    }
}

/**
 * Message size error
 *
 * @remarks
 * Thrown when an incoming message exceeds the maximum allowed payload size.
 * This is a security measure to prevent DoS attacks via large message payloads.
 *
 * @property dataSize - The actual size of the message in bytes
 * @property maxSize - The maximum allowed message size in bytes
 *
 * @example
 * ```ts
 * if (messageSize > maxPayload) {
 *   throw new MessageSizeError(messageSize, maxPayload)
 * }
 * ```
 */
export class MessageSizeError extends TransportError {
    /**
     * The actual size of the message that exceeded the limit
     */
    public readonly dataSize: number

    /**
     * The maximum allowed message size
     */
    public readonly maxSize: number

    /**
     * Creates a new MessageSizeError
     *
     * @param dataSize - The actual size of the message in bytes
     * @param maxSize - The maximum allowed message size in bytes
     */
    constructor(dataSize: number, maxSize: number) {
        const message = `Message size ${dataSize} bytes exceeds maximum allowed size of ${maxSize} bytes`
        const context = { dataSize, maxSize }

        super(message, context)
        this.name = 'MessageSizeError'
        this.dataSize = dataSize
        this.maxSize = maxSize

        // Override the code for specific error handling
        this.code = 'MESSAGE_TOO_LARGE'

        // Maintains proper stack trace (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MessageSizeError)
        }
    }

    /**
     * Convert error to JSON for logging/serialization
     *
     * @returns JSON representation with size information
     *
     * @example
     * ```ts
     * const error = new MessageSizeError(2048, 1024)
     * console.log(JSON.stringify(error.toJSON(), null, 2))
     * // {
     * //   "name": "MessageSizeError",
     * //   "message": "Message size 2048 bytes exceeds maximum allowed size of 1024 bytes",
     * //   "code": "MESSAGE_TOO_LARGE",
     * //   "dataSize": 2048,
     * //   "maxSize": 1024,
     * //   "stack": "..."
     * // }
     * ```
     */
    override toJSON(): {
        name: string
        message: string
        code: string
        dataSize: number
        maxSize: number
        context?: Record<string, unknown>
        stack?: string
    } {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            dataSize: this.dataSize,
            maxSize: this.maxSize,
            context: this.context,
            stack: this.stack,
        }
    }

    /**
     * Get a summary of the error for logging
     *
     * @returns Formatted error summary string
     *
     * @example
     * ```ts
     * const error = new MessageSizeError(2048, 1024)
     * console.log(error.toString())
     * // "[MessageSizeError:MESSAGE_TOO_LARGE] Message size 2048 bytes exceeds maximum allowed size of 1024 bytes"
     * ```
     */
    override toString(): string {
        return `[${this.name}:${this.code}] ${this.message}`
    }
}

/**
 * Channel error
 *
 * @remarks
 * Thrown when channel operations fail (invalid channel name, etc.).
 *
 * @example
 * ```ts
 * if (channelName.startsWith('__')) {
 *   throw new ChannelError('Reserved channel name', { channelName })
 * }
 * ```
 */
export class ChannelError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CHANNEL_ERROR', context)
        this.name = 'ChannelError'
    }
}

/**
 * Client error
 *
 * @remarks
 * Thrown when client operations fail (client not found, etc.).
 *
 * @example
 * ```ts
 * if (!registry.has(clientId)) {
 *   throw new ClientError('Client not found', { clientId })
 * }
 * ```
 */
export class ClientError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CLIENT_ERROR', context)
        this.name = 'ClientError'
    }
}

/**
 * Message error
 *
 * @remarks
 * Thrown when message processing fails (invalid format, etc.).
 *
 * @example
 * ```ts
 * if (!message.type) {
 *   throw new MessageError('Invalid message format', { message })
 * }
 * ```
 */
export class MessageError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'MESSAGE_ERROR', context)
        this.name = 'MessageError'
    }
}

/**
 * Validation error
 *
 * @remarks
 * Thrown when input validation fails.
 *
 * @example
 * ```ts
 * if (!isValidChannelName(name)) {
 *   throw new ValidationError('Invalid channel name', { name })
 * }
 * ```
 */
export class ValidationError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', context)
        this.name = 'ValidationError'
    }
}

/**
 * State error
 *
 * @remarks
 * Thrown when an operation is invalid for the current state.
 *
 * @example
 * ```ts
 * if (server.started) {
 *   throw new StateError('Server is already started')
 * }
 *
 * if (!server.started) {
 *   throw new StateError('Server must be started first')
 * }
 * ```
 */
export class StateError extends SyncarError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'STATE_ERROR', context)
        this.name = 'StateError'
    }
}

// ============================================================
// MIDDLEWARE REJECTION ERROR
// ============================================================

/**
 * Middleware rejection error
 * @example
 * ```ts
 * if (!context.req.client) context.reject('Client is required')
 * ```
 */
export class MiddlewareRejectionError
    extends Error
    implements IMiddlewareRejectionError
{
    /**
     * The reason for rejection
     *
     * @remarks
     * Human-readable explanation of why the action was rejected.
     */
    public readonly reason: string

    /**
     * The action that was rejected
     *
     * @remarks
     * One of: 'connect', 'disconnect', 'message', 'subscribe', 'unsubscribe'
     */
    public readonly action: string

    /**
     * Error name (fixed value for interface compliance)
     */
    public override readonly name = 'MiddlewareRejectionError'

    /**
     * Optional error code for programmatic handling
     *
     * @remarks
     * Can be used for mapping to client-facing error codes.
     */
    public readonly code?: string

    /**
     * Additional context about the rejection
     *
     * @remarks
     * Arbitrary data for debugging or logging.
     */
    public readonly context?: Record<string, unknown>

    /**
     * Creates a new MiddlewareRejectionError
     *
     * @param reason - Human-readable reason for the rejection
     * @param action - The action that was rejected
     * @param code - Optional error code for programmatic handling
     * @param context - Additional context about the rejection
     */
    constructor(
        reason: string,
        action: IMiddlewareAction | string,
        code?: string,
        context?: Record<string, unknown>,
    ) {
        super(`Action '${action}' rejected: ${reason}`)
        this.reason = reason
        this.action = typeof action === 'string' ? action : action

        // Set error name for instanceof checks
        this.name = 'MiddlewareRejectionError'

        // Optional code and context
        this.code = code
        this.context = context

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MiddlewareRejectionError)
        }
    }

    /**
     * Convert error to JSON for logging/serialization
     *
     * @returns JSON representation of the rejection error
     *
     * @example
     * ```ts
     * const error = new MiddlewareRejectionError('Not allowed', 'subscribe', 'FORBIDDEN')
     * console.log(JSON.stringify(error.toJSON(), null, 2))
     * // {
     * //   "name": "MiddlewareRejectionError",
     * //   "reason": "Not allowed",
     * //   "action": "subscribe",
     * //   "code": "FORBIDDEN",
     * //   "message": "Action 'subscribe' rejected: Not allowed",
     * //   "stack": "..."
     * // }
     * ```
     */
    toJSON(): {
        name: string
        reason: string
        action: string
        code?: string
        context?: Record<string, unknown>
        message: string
        stack?: string
    } {
        return {
            name: this.name,
            reason: this.reason,
            action: this.action,
            code: this.code,
            context: this.context,
            message: this.message,
            stack: this.stack,
        }
    }

    /**
     * Get a summary of the rejection for logging
     *
     * @returns Formatted error summary string
     *
     * @example
     * ```ts
     * const error = new MiddlewareRejectionError('Not allowed', 'subscribe')
     * console.log(error.toString())
     * // "[MiddlewareRejectionError:subscribe] Not allowed"
     * ```
     */
    override toString(): string {
        return `[${this.name}:${this.action}] ${this.reason}`
    }
}

// ============================================================
// MIDDLEWARE EXECUTION ERROR
// ============================================================

/**
 * Middleware execution error
 *
 * @remarks
 * Thrown when a middleware function throws an unexpected error
 * (not using `context.reject()`). This indicates a bug or failure
 * in the middleware rather than an intentional rejection.
 *
 * @property action - The action being processed when the error occurred
 * @property middleware - The name/index of the middleware that failed
 * @property cause - The original error thrown by the middleware
 *
 * @example
 * ### Error scenario
 * ```ts
 * const buggyMiddleware: Middleware = async (context, next) => {
 *   // This throws an unexpected error
 *   JSON.parse(context.req.message as string)
 *   await next()
 * }
 * // Results in MiddlewareExecutionError
 * ```
 *
 * @example
 * ### Catching execution errors
 * ```ts
 * try {
 *   await manager.execute(context)
 * } catch (error) {
 *   if (error instanceof MiddlewareExecutionError) {
 *     console.error(`${error.middleware} failed during ${error.action}:`)
 *     console.error(error.cause)
 *   }
 * }
 * ```
 */
export class MiddlewareExecutionError extends Error {
    /**
     * The action being processed when the error occurred
     */
    public readonly action: string

    /**
     * The name/index of the middleware that failed
     */
    public readonly middleware: string

    /**
     * The original error thrown by the middleware
     */
    public override readonly cause: Error

    /**
     * Creates a new MiddlewareExecutionError
     *
     * @param action - The action being processed
     * @param middleware - The name/index of the middleware
     * @param cause - The original error
     */
    constructor(action: string, middleware: string, cause: Error) {
        super(
            `Middleware execution error in ${middleware} during ${action}: ${cause.message}`,
        )
        this.name = 'MiddlewareExecutionError'
        this.action = action
        this.middleware = middleware
        this.cause = cause

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MiddlewareExecutionError)
        }
    }

    /**
     * Get the original error cause
     *
     * @returns The original error thrown by the middleware
     *
     * @example
     * ```ts
     * if (error instanceof MiddlewareExecutionError) {
     *   const originalError = error.getCause()
     *   console.error('Original error:', originalError.message)
     * }
     * ```
     */
    getCause(): Error {
        return this.cause
    }

    /**
     * Get a summary of the error for logging
     *
     * @returns Formatted error summary string
     *
     * @example
     * ```ts
     * const error = new MiddlewareExecutionError('message', 'auth', originalError)
     * console.log(error.toString())
     * // "[MiddlewareExecutionError] auth failed during message: Invalid token"
     * ```
     */
    override toString(): string {
        return `[${this.name}] ${this.middleware} failed during ${this.action}: ${this.cause.message}`
    }
}
