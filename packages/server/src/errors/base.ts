/**
 * Base Error Classes
 * Custom error classes for the Synnel server.
 *
 * @module errors/base
 */

// ============================================================
// BASE SYNNEL ERROR
// ============================================================

/**
 * Base Synnel error class
 * All custom errors in the Synnel server should extend this class.
 *
 * @example
 * ```ts
 * import { SynnelError } from '@synnel/server/errors'
 *
 * class CustomError extends SynnelError {
 *   constructor(message: string, public code: string) {
 *     super(message)
 *     this.name = 'CustomError'
 *   }
 * }
 *
 * throw new CustomError('Something went wrong', 'CUSTOM_ERROR')
 * ```
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
   *
   * @example
   * ```ts
   * try {
   *   // ...
   * } catch (error) {
   *   if (error instanceof SynnelError) {
   *     console.log(JSON.stringify(error.toJSON()))
   *   }
   * }
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
   * @example
   * ```ts
   * console.error(error.toString())
   * // Output: [SynnelError:AUTH_FAILED] Invalid credentials
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
