/**
 * Errors Module
 * Custom error classes for the Synnel server.
 *
 * @module errors
 */

import type { IMiddlewareRejectionError, IMiddlewareAction } from './types'

// ============================================================
// BASE SYNNEL ERROR
// ============================================================

/**
 * Base Synnel error class
 * All custom errors in the Synnel server should extend this class.
 */
export class SynnelError extends Error {
    /**
     * Error code for programmatic error handling
     */
    public readonly code: string

    /**
     * Additional error context (optional)
     */
    public readonly context?: Record<string, unknown>

    constructor(
        message: string,
        code: string = 'SYNNEL_ERROR',
        context?: Record<string, unknown>,
    ) {
        super(message)
        this.name = 'SynnelError'
        this.code = code
        this.context = context

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SynnelError)
        }
    }

    /**
     * Convert error to JSON for logging/serialization
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
 * Thrown when server configuration is invalid
 */
export class ConfigError extends SynnelError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CONFIG_ERROR', context)
        this.name = 'ConfigError'
    }
}

/**
 * Transport error
 * Thrown when transport layer fails (WebSocket connection issues, etc.)
 */
export class TransportError extends SynnelError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'TRANSPORT_ERROR', context)
        this.name = 'TransportError'
    }
}

/**
 * Channel error
 * Thrown when channel operations fail
 */
export class ChannelError extends SynnelError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CHANNEL_ERROR', context)
        this.name = 'ChannelError'
    }
}

/**
 * Client error
 * Thrown when client operations fail
 */
export class ClientError extends SynnelError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'CLIENT_ERROR', context)
        this.name = 'ClientError'
    }
}

/**
 * Message error
 * Thrown when message processing fails
 */
export class MessageError extends SynnelError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'MESSAGE_ERROR', context)
        this.name = 'MessageError'
    }
}

/**
 * Validation error
 * Thrown when input validation fails
 */
export class ValidationError extends SynnelError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', context)
        this.name = 'ValidationError'
    }
}

/**
 * State error
 * Thrown when an operation is invalid for the current state
 */
export class StateError extends SynnelError {
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
 * Thrown when middleware rejects an action using the `reject()` function.
 */
export class MiddlewareRejectionError
    extends Error
    implements IMiddlewareRejectionError {
    /**
     * The reason for rejection
     */
    public readonly reason: string

    /**
     * The action that was rejected
     */
    public readonly action: string

    /**
     * Error name (fixed value for interface compliance)
     */
    public override readonly name = 'MiddlewareRejectionError'

    /**
     * Optional error code for programmatic handling
     */
    public readonly code?: string

    /**
     * Additional context about the rejection
     */
    public readonly context?: Record<string, unknown>

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
 * Thrown when a middleware function throws an unexpected error
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
     */
    getCause(): Error {
        return this.cause
    }

    override toString(): string {
        return `[${this.name}] ${this.middleware} failed during ${this.action}: ${this.cause.message}`
    }
}
