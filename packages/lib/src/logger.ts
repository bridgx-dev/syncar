/**
 * Logging utilities
 */

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
): LoggerFn {
  const logEnabled = {
    debug: false,
    info: true,
    warn: true,
    error: true,
    ...enabled,
  }

  return (level: LogLevel, message: string, ...args: unknown[]): void => {
    if (!logEnabled[level]) {
      return
    }

    const timestamp = createLogTimestamp()
    const logMessage = `[${prefix} ${timestamp}] [${LOG_LEVEL_NAMES[level]}] ${message}`

    switch (level) {
      case 'error':
        console.error(logMessage, ...args)
        break
      case 'warn':
        console.warn(logMessage, ...args)
        break
      case 'debug':
      case 'info':
      default:
        console.log(logMessage, ...args)
        break
    }
  }
}

/**
 * Create a no-op logger (silences all output)
 */
export function createNoOpLogger(): LoggerFn {
  return (): void => {
    // No-op
  }
}

/**
 * Create a logger that delegates to another logger with a prefix
 */
export function createPrefixedLogger(
  baseLogger: LoggerFn,
  prefix: string,
): LoggerFn {
  return (level: LogLevel, message: string, ...args: unknown[]): void => {
    baseLogger(level, `[${prefix}] ${message}`, ...args)
  }
}

/**
 * Create a filtered logger that only logs certain levels
 */
export function createFilteredLogger(
  baseLogger: LoggerFn,
  allowedLevels: LogLevel[],
): LoggerFn {
  return (level: LogLevel, message: string, ...args: unknown[]): void => {
    if (allowedLevels.includes(level)) {
      baseLogger(level, message, ...args)
    }
  }
}

/**
 * Create a logger with a minimum level threshold
 * Logs at or above the threshold will be output
 */
export function createThresholdLogger(
  baseLogger: LoggerFn,
  minLevel: LogLevel,
): LoggerFn {
  const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  const minPriority = levelPriority[minLevel]

  return (level: LogLevel, message: string, ...args: unknown[]): void => {
    if (levelPriority[level] >= minPriority) {
      baseLogger(level, message, ...args)
    }
  }
}

/**
 * Create a debug logger wrapper
 */
export function createDebugLogger(
  baseLogger: LoggerFn,
  debug = true,
): LoggerFn {
  if (!debug) {
    return createFilteredLogger(baseLogger, ['info', 'warn', 'error'])
  }
  return baseLogger
}
