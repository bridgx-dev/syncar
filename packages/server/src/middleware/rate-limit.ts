import type {
    IMiddleware,
    Context,
    IMiddlewareAction,
} from '../types'

/**
 * Rate limit middleware options
 */
export interface RateLimitOptions {
    /**
     * Maximum number of requests allowed per window
     * @default 100
     */
    maxRequests?: number

    /**
     * Time window in milliseconds
     * @default 60000 (1 minute)
     */
    windowMs?: number

    /**
     * Extract a unique identifier for rate limiting
     * Defaults to client ID
     */
    getMessageId?: (c: Context) => string

    /**
     * Actions to rate limit
     * @default 'message' only
     */
    actions?: IMiddlewareAction[]
}

/**
 * Rate limit state for each client
 */
export interface RateLimitState {
    count: number
    resetTime: number
}

/**
 * Rate limit storage
 * Maps client ID to rate limit state
 */
const rateLimitStore = new Map<string, RateLimitState>()

/**
 * Create a rate limiting middleware
 *
 * Limits the rate of requests per client within a time window.
 */
export function rateLimit(options: RateLimitOptions = {}): IMiddleware {
    const {
        maxRequests = 100,
        windowMs = 60000,
        getMessageId = (c) => c.req.client?.id ?? '',
        actions = ['message'],
    } = options

    // Clean up expired entries periodically (every 10 windows)
    const cleanupInterval = setInterval(() => {
        const now = Date.now()
        for (const [id, state] of rateLimitStore) {
            if (state.resetTime < now) {
                rateLimitStore.delete(id)
            }
        }
    }, windowMs * 10)

    // Return middleware with cleanup
    const middleware: IMiddleware = async (c, next) => {
        // Check if this action should be rate limited
        if (!actions.includes(c.req.action)) {
            return next()
        }

        const id = getMessageId(c)
        if (!id) {
            return next() // No ID to rate limit
        }

        const now = Date.now()
        const state = rateLimitStore.get(id)

        // Check if window has expired
        if (state && state.resetTime < now) {
            rateLimitStore.delete(id)
        }

        // Get or create state
        let currentState = rateLimitStore.get(id)
        if (!currentState) {
            currentState = {
                count: 0,
                resetTime: now + windowMs,
            }
            rateLimitStore.set(id, currentState)
        }

        // Check limit
        if (currentState.count >= maxRequests) {
            return c.reject(
                `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs}ms`,
            )
        }

        // Increment counter
        currentState.count++

        // CONTINUE
        await next()
    }

        // Attach cleanup method
        ; (middleware as { cleanup?: () => void }).cleanup = () => {
            clearInterval(cleanupInterval)
            rateLimitStore.clear()
        }

    return middleware
}

/**
 * Clear the rate limit store
 * Useful for testing or manual reset
 */
export function clearRateLimitStore(): void {
    rateLimitStore.clear()
}

/**
 * Get rate limit state for a specific client
 *
 * @param id - Client or message ID
 * @returns Rate limit state or undefined
 */
export function getRateLimitState(id: string): RateLimitState | undefined {
    return rateLimitStore.get(id)
}
