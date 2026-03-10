import type {
    IMiddleware,
    IMiddlewareAction,
} from '../types'

/**
 * Logging middleware options
 */
export interface LoggingOptions {
    /**
     * Logger instance to use
     * @default console
     */
    logger?: Pick<Console, 'log' | 'info' | 'warn' | 'error'>

    /**
     * Log level
     * @default 'info'
     */
    logLevel?: 'log' | 'info' | 'warn' | 'error'

    /**
     * Whether to include message data in logs
     * @default false
     */
    includeMessageData?: boolean

    /**
     * Custom format function for log output
     */
    format?: (context: {
        action: string
        clientId?: string
        channel?: string
        message?: unknown
        duration?: number
    }) => string

    /**
     * Actions to log
     * @default All actions are logged
     */
    actions?: IMiddlewareAction[]
}

/**
 * Create a logging middleware
 *
 * Logs all middleware actions with client and action information.
 */
export function logger(options: LoggingOptions = {}): IMiddleware {
    const {
        logger = console,
        logLevel = 'info',
        includeMessageData = false,
        format,
        actions,
    } = options

    return async (c, next) => {
        // Check if this action should be logged
        if (actions && !actions.includes(c.req.action)) {
            return next()
        }

        const start = Date.now()

        await next() // Wait for downstream layers

        const duration = Date.now() - start

        const logData = {
            action: c.req.action,
            clientId: c.req.client?.id,
            channel: c.req.channel,
            message: includeMessageData ? c.req.message : undefined,
            duration,
        }

        const logMessage = format
            ? format(logData)
            : `[${logData.action}] Client: ${logData.clientId ?? 'unknown'}${logData.channel ? ` Channel: ${logData.channel}` : ''} (${duration}ms)`

        logger[logLevel](logMessage)
    }
}
