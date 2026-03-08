/**
 * Middleware Factories
 * Factory functions for creating common middleware implementations.
 *
 * @module middleware/factories
 */

import type {
  IMiddleware,
  Context,
  IMiddlewareAction,
  IClientConnection,
  ChannelName,
} from '../types'

// ============================================================
// AUTH MIDDLEWARE FACTORY
// ============================================================

/**
 * Auth middleware options
 *
 * @example
 * ```ts
 * const options: AuthMiddlewareOptions = {
 *   verifyToken: async (token) => {
 *     const user = await verifyJwt(token)
 *     return { id: user.id, email: user.email }
 *   },
 *   getToken: (context) => {
 *     // Extract token from message or connection
 *     return context.message?.data?.token
 *   },
 *   attachProperty: 'user'
 * }
 * ```
 */
export interface AuthMiddlewareOptions {
  /**
   * Verify and decode a token
   * Returns the user data to attach to the client
   *
   * @param token - The token to verify
   * @returns User data to attach
   * @throws Error if token is invalid
   */
  verifyToken: (token: string) => Promise<unknown> | unknown

  /**
   * Extract token from the middleware context
   *
   * @param c - The middleware context
   * @returns The token string or undefined if not found
   */
  getToken?: (c: Context) => string | undefined

  /**
   * Property name to attach verified user data
   * @default 'user'
   */
  attachProperty?: string

  /**
   * Actions to require authentication
   * @default All actions require auth
   */
  actions?: IMiddlewareAction[]
}

/**
 * Create an authentication middleware
 *
 * This middleware verifies tokens and attaches user data to clients.
 * Rejects connections that fail authentication.
 *
 * @param options - Authentication options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { createAuthMiddleware } from '@synnel/server/middleware'
 *
 * const authMiddleware = createAuthMiddleware({
 *   verifyToken: async (token) => {
 *     const user = await jwt.verify(token, SECRET)
 *     return { id: user.sub, email: user.email }
 *   },
 *   getToken: (context) => context.message?.data?.token,
 *   attachProperty: 'user'
 * })
 *
 * server.use(authMiddleware)
 * ```
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions,
): IMiddleware {
  const {
    verifyToken,
    getToken = (c) => {
      // Default: extract token from message.data.token
      const msg = c.req.message as { data?: { token?: string } } | undefined
      return msg?.data?.token
    },
    attachProperty = 'user',
    actions,
  } = options

  return async (c, next) => {
    // Check if this action requires auth
    if (actions && !actions.includes(c.req.action)) {
      return next()
    }

    // Extract token
    const token = getToken(c)
    if (!token) {
      c.reject('Authentication token required')
    }

    // Verify token
    try {
      const userData = await verifyToken(token!)

      // Attach user data to client (LEGACY - for compatibility)
      if (c.req.client) {
        ; (c.req.client as unknown as Record<string, unknown>)[
          attachProperty
        ] = userData
      }

      // Attach to STATE (Hono-style)
      c.set(attachProperty, userData)

      // PASS TO NEXT LAYER
      await next()
    } catch (error) {
      c.reject('Authentication failed: Invalid token')
    }
  }
}

// ============================================================
// LOGGING MIDDLEWARE FACTORY
// ============================================================

/**
 * Logging middleware options
 *
 * @example
 * ```ts
 * const options: LoggingMiddlewareOptions = {
 *   logger: console,
 *   logLevel: 'info',
 *   includeMessageData: false
 * }
 * ```
 */
export interface LoggingMiddlewareOptions {
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
   *
   * @param context - The middleware context
   * @returns Formatted log string
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
 *
 * @param options - Logging options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { createLoggingMiddleware } from '@synnel/server/middleware'
 *
 * const loggingMiddleware = createLoggingMiddleware({
 *   logger: console,
 *   logLevel: 'info',
 *   includeMessageData: false
 * })
 *
 * server.use(loggingMiddleware)
 * ```
 */
export function createLoggingMiddleware(
  options: LoggingMiddlewareOptions = {},
): IMiddleware {
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

// ============================================================
// RATE LIMIT MIDDLEWARE FACTORY
// ============================================================

/**
 * Rate limit middleware options
 *
 * @example
 * ```ts
 * const options: RateLimitMiddlewareOptions = {
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   getMessageId: (context) => context.client?.id ?? ''
 * }
 * ```
 */
export interface RateLimitMiddlewareOptions {
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
   *
   * @param c - The middleware context
   * @returns Unique identifier for rate limiting
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
interface RateLimitState {
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
 *
 * @param options - Rate limit options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { createRateLimitMiddleware } from '@synnel/server/middleware'
 *
 * const rateLimitMiddleware = createRateLimitMiddleware({
 *   maxRequests: 100,
 *   windowMs: 60000
 * })
 *
 * server.use(rateLimitMiddleware)
 * ```
 */
export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions = {},
): IMiddleware {
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
      c.reject(
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
 *
 * @example
 * ```ts
 * import { clearRateLimitStore } from '@synnel/server/middleware'
 *
 * clearRateLimitStore()
 * ```
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear()
}

/**
 * Get rate limit state for a specific client
 *
 * @param id - Client or message ID
 * @returns Rate limit state or undefined
 *
 * @example
 * ```ts
 * import { getRateLimitState } from '@synnel/server/middleware'
 *
 * const state = getRateLimitState('client-123')
 * console.log(`Requests: ${state?.count ?? 0}/${maxRequests}`)
 * ```
 */
export function getRateLimitState(id: string): RateLimitState | undefined {
  return rateLimitStore.get(id)
}

// ============================================================
// CHANNEL WHITELIST MIDDLEWARE FACTORY
// ============================================================

/**
 * Channel whitelist middleware options
 *
 * @example
 * ```ts
 * const options: ChannelWhitelistMiddlewareOptions = {
 *   allowedChannels: ['chat', 'notifications'],
 *   isDynamic: false
 * }
 * ```
 */
export interface ChannelWhitelistMiddlewareOptions {
  /**
   * List of allowed channels
   * If isDynamic is true, this is used as a fallback
   */
  allowedChannels?: ChannelName[]

  /**
   * Dynamic check function for channel access
   * If provided, this takes precedence over allowedChannels
   *
   * @param channel - The channel name to check
   * @param client - The client attempting to access the channel
   * @returns true if channel is allowed
   *
   * @example
   * ```ts
   * const isDynamic: (channel, client) => {
   *   // Check if user has permission for this channel
   *   return user.permissions.includes(channel)
   * }
   * ```
   */
  isDynamic?: (channel: ChannelName, client?: IClientConnection) => boolean

  /**
   * Whether to also check unsubscribe actions
   * @default false (only restrict subscribe)
   */
  restrictUnsubscribe?: boolean
}

/**
 * Create a channel whitelist middleware
 *
 * Restricts which channels clients can subscribe to.
 *
 * @param options - Channel whitelist options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { createChannelWhitelistMiddleware } from '@synnel/server/middleware'
 *
 * const whitelistMiddleware = createChannelWhitelistMiddleware({
 *   allowedChannels: ['chat', 'notifications']
 * })
 *
 * server.use(whitelistMiddleware)
 * ```
 */
export function createChannelWhitelistMiddleware(
  options: ChannelWhitelistMiddlewareOptions = {},
): IMiddleware {
  const {
    allowedChannels = [],
    isDynamic,
    restrictUnsubscribe = false,
  } = options

  return async (c, next) => {
    // Only check subscribe/unsubscribe actions
    if (c.req.action !== 'subscribe' && c.req.action !== 'unsubscribe') {
      return next()
    }

    // Skip unsubscribe if not restricted
    if (c.req.action === 'unsubscribe' && !restrictUnsubscribe) {
      return next()
    }

    if (!c.req.channel) {
      return next() // No channel to check
    }

    // Check dynamic function first
    if (isDynamic) {
      if (!isDynamic(c.req.channel, c.req.client)) {
        c.reject(`Channel '${c.req.channel}' is not allowed`)
      }
      return next()
    }

    // Check static whitelist
    if (!allowedChannels.includes(c.req.channel)) {
      c.reject(`Channel '${c.req.channel}' is not allowed`)
    }

    await next()
  }
}
