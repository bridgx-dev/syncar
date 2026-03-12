import type { IMiddleware, IContext, IMiddlewareAction } from '../types'

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
    getMessageId?: (c: IContext) => string

    /**
     * Actions to rate limit
     * @default 'message' only
     */
    actions?: IMiddlewareAction[]

    /**
     * Maximum number of entries in the rate limit store
     * Prevents memory exhaustion DoS attacks
     * @default 10000
     */
    maxEntries?: number

    /**
     * Cleanup interval for expired entries
     * More frequent cleanup prevents memory bloat
     * @default 60000 (1 minute)
     */
    cleanupIntervalMs?: number
}

/**
 * Rate limit state for each client
 */
export interface RateLimitState {
    count: number
    resetTime: number
}

/**
 * Rate limit storage with per-ID locks for atomic operations
 * Maps client ID to rate limit state
 *
 * @security The locks Map ensures that concurrent requests for the same ID
 * are processed sequentially, preventing TOCTOU (Time-of-Check-Time-of-Use) race conditions.
 */
const rateLimitStore = new Map<string, RateLimitState>()

/**
 * Per-ID pending operations to ensure atomicity
 * When a request is being processed for an ID, a Promise is stored here.
 * Concurrent requests for the same ID await the existing Promise.
 *
 * @security This prevents race conditions where multiple concurrent requests
 * could all pass the limit check before any of them increments the counter.
 */
const pendingOperations = new Map<string, Promise<void>>()

/**
 * Create a rate limiting middleware
 *
 * Limits the rate of requests per client within a time window.
 *
 * @security Uses per-ID locking to prevent TOCTOU race conditions.
 * Multiple concurrent requests for the same ID are serialized.
 */
export function rateLimit(options: RateLimitOptions = {}): IMiddleware {
    const {
        maxRequests = 100,
        windowMs = 60000,
        getMessageId = (c) => c.req.client?.id ?? '',
        actions = ['message'],
        maxEntries = 10000,
        cleanupIntervalMs = 60000,
    } = options

    /**
     * Atomically check and increment rate limit for a given ID
     *
     * This function ensures that the entire check-and-increment operation
     * happens atomically for each ID, preventing race conditions.
     *
     * @param id - The unique identifier for rate limiting
     * @param now - Current timestamp
     * @returns true if request should be allowed, false if rate limited
     */
    const checkAndIncrement = (id: string, now: number): boolean => {
        // Enforce maximum entry limit to prevent memory exhaustion DoS
        if (rateLimitStore.size >= maxEntries && !rateLimitStore.has(id)) {
            // Store is full and this is a new ID - reject
            return false
        }

        const state = rateLimitStore.get(id)

        // Check if window has expired or no state exists
        if (!state || state.resetTime < now) {
            // Create fresh state
            rateLimitStore.set(id, {
                count: 1,
                resetTime: now + windowMs,
            })
            return true
        }

        // Check if limit exceeded
        if (state.count >= maxRequests) {
            return false
        }

        // Increment counter atomically (synchronous operation)
        state.count++
        return true
    }

    // Clean up expired entries periodically
    const cleanupInterval = setInterval(() => {
        const now = Date.now()
        const idsToDelete: string[] = []

        // Find expired entries
        for (const [id, state] of rateLimitStore) {
            if (state.resetTime < now) {
                idsToDelete.push(id)
            }
        }

        // Delete expired entries
        for (const id of idsToDelete) {
            rateLimitStore.delete(id)
            pendingOperations.delete(id)
        }
    }, cleanupIntervalMs)

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

        // Ensure atomicity by serializing concurrent requests for the same ID
        let pendingPromise = pendingOperations.get(id)

        if (pendingPromise) {
            // Another request is processing this ID - wait for it
            await pendingPromise
        }

        // Create new operation promise for this ID
        let resolveOperation: () => void
        const operationPromise = new Promise<void>((resolve) => {
            resolveOperation = resolve
        })

        pendingOperations.set(id, operationPromise)

        try {
            // Atomic check-and-increment
            const allowed = checkAndIncrement(id, now)

            if (!allowed) {
                const state = rateLimitStore.get(id)
                const resetIn = state ? Math.max(0, state.resetTime - now) : 0
                return c.reject(
                    `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs}ms. Reset in ${resetIn}ms`,
                )
            }

            // CONTINUE
            await next()
        } finally {
            // Clean up pending operation
            pendingOperations.delete(id)
            // Resolve any waiting requests
            resolveOperation!()
        }
    }

    // Attach cleanup method
    ;(middleware as { cleanup?: () => void }).cleanup = () => {
        clearInterval(cleanupInterval)
        rateLimitStore.clear()
        pendingOperations.clear()
    }

    return middleware
}

/**
 * Clear the rate limit store
 * Useful for testing or manual reset
 */
export function clearRateLimitStore(): void {
    rateLimitStore.clear()
    pendingOperations.clear()
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

/**
 * Get the current size of the rate limit store
 * Useful for monitoring and detecting potential memory issues
 *
 * @returns Number of entries in the store
 */
export function getRateLimitStoreSize(): number {
    return rateLimitStore.size
}

/**
 * Reset rate limit for a specific client
 * Useful for testing or manual intervention
 *
 * @param id - Client or message ID to reset
 */
export function resetRateLimit(id: string): void {
    rateLimitStore.delete(id)
    pendingOperations.delete(id)
}
