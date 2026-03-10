import type {
    MessageId,
    ClientId,
    ChannelName,
    Message,
    DataMessage,
    SignalMessage,
    SignalType,
    ILogger,
} from './types'
import { MessageType } from './types'

// ============================================================
// ID GENERATION UTILITIES
// ============================================================

/**
 * Generate a unique message ID
 * Format: timestamp-randomString
 */
export function generateMessageId(): MessageId {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Generate a unique client ID
 * Format: client-timestamp-randomString
 */
export function generateClientId(): ClientId {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// ============================================================
// VALIDATION UTILITIES
// ============================================================

const CHANNEL_NAME_MIN_LENGTH = 1
const CHANNEL_NAME_MAX_LENGTH = 128
const RESERVED_PREFIX = '__'

/**
 * Validate channel name
 * Channel names must be non-empty strings with reasonable length
 */
export function isValidChannelName(name: ChannelName): boolean {
    return (
        typeof name === 'string' &&
        name.length >= CHANNEL_NAME_MIN_LENGTH &&
        name.length <= CHANNEL_NAME_MAX_LENGTH
    )
}

/**
 * Check if channel name is reserved for system use
 * Reserved channel names start with '__'
 */
export function isReservedChannelName(name: ChannelName): boolean {
    return name.startsWith(RESERVED_PREFIX)
}

/**
 * Assert that channel name is valid
 * @throws Error if channel name is invalid
 */
export function assertValidChannelName(name: ChannelName): void {
    if (!isValidChannelName(name)) {
        throw new Error(
            `Invalid channel name: must be between ${CHANNEL_NAME_MIN_LENGTH} and ${CHANNEL_NAME_MAX_LENGTH} characters`,
        )
    }
}

// ============================================================
// MESSAGE UTILITIES
// ============================================================

/**
 * Guard to check if message is a DataMessage
 */
export function isDataMessage<T = unknown>(
    message: Message<T>,
): message is DataMessage<T> {
    return message.type === MessageType.DATA
}

/**
 * Create a data message
 */
export function createDataMessage<T>(
    channel: ChannelName,
    data: T,
    id?: MessageId,
): DataMessage<T> {
    return {
        id: id || generateMessageId(),
        type: MessageType.DATA,
        channel,
        data,
        timestamp: Date.now(),
    }
}

/**
 * Create a signal message
 */
export function createSignalMessage(
    channel: ChannelName,
    signal: SignalType,
    data?: any,
    id?: MessageId,
): SignalMessage {
    return {
        id: id || generateMessageId(),
        type: MessageType.SIGNAL,
        channel,
        signal,
        data,
        timestamp: Date.now(),
    }
}

// ============================================================
// LOGGING UTILITIES
// ============================================================

/**
 * Log levels
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/**
 * Logger function signature
 */
export type LoggerFn = (
    level: LogLevel,
    message: string,
    ...args: unknown[]
) => void

/**
 * Default log level names for display
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    debug: 'DEBUG',
}

/**
 * Create a timestamp for log messages
 */
export function createLogTimestamp(): string {
    return new Date().toISOString()
}

/**
 * Default logger implementation
 * Logs to console with timestamp and level
 */
export function createDefaultLogger(
    prefix = 'Syncar',
    enabled: { [K in LogLevel]?: boolean } = {},
): ILogger {
    const logEnabled = {
        debug: false,
        info: true,
        warn: true,
        error: true,
        ...enabled,
    }

    const formatMessage = (level: LogLevel, message: string): string => {
        const timestamp = createLogTimestamp()
        return `[${prefix} ${timestamp}] [${LOG_LEVEL_NAMES[level]}] ${message}`
    }

    return {
        debug: (message: string, ...args: unknown[]) => {
            if (logEnabled.debug)
                console.log(formatMessage('debug', message), ...args)
        },
        info: (message: string, ...args: unknown[]) => {
            if (logEnabled.info)
                console.log(formatMessage('info', message), ...args)
        },
        warn: (message: string, ...args: unknown[]) => {
            if (logEnabled.warn)
                console.warn(formatMessage('warn', message), ...args)
        },
        error: (message: string, ...args: unknown[]) => {
            if (logEnabled.error)
                console.error(formatMessage('error', message), ...args)
        },
    }
}
