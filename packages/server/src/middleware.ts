/**
 * Middleware System
 * Extensible middleware for processing connections, messages, and actions
 */

import type {
  ServerMiddleware,
  MiddlewareContext,
  ServerClient,
} from './types.js'
import type { Message, ChannelName } from '@synnel/core'

/**
 * Middleware execution error
 */
export class MiddlewareRejectionError extends Error {
  constructor(
    public reason: string,
    public action: string,
  ) {
    super(`Action '${action}' rejected: ${reason}`)
    this.name = 'MiddlewareRejectionError'
  }
}

/**
 * Middleware Manager
 * Executes middleware functions in sequence
 */
export class MiddlewareManager {
  private middleware: ServerMiddleware[] = []

  /**
   * Add a middleware function
   */
  use(middleware: ServerMiddleware): void {
    this.middleware.push(middleware)
  }

  /**
   * Remove a middleware function
   */
  remove(middleware: ServerMiddleware): boolean {
    const index = this.middleware.indexOf(middleware)
    if (index !== -1) {
      this.middleware.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middleware = []
  }

  /**
   * Execute middleware for a connection action
   */
  async executeConnection(
    client: ServerClient,
    action: 'connect' | 'disconnect',
  ): Promise<void> {
    const context: MiddlewareContext = {
      client,
      action,
      channel: undefined,
      message: undefined,
      reject: (reason: string) => {
        throw new MiddlewareRejectionError(reason, action)
      },
    }

    await this.executeAll(context)
  }

  /**
   * Execute middleware for a message action
   */
  async executeMessage(client: ServerClient, message: Message): Promise<void> {
    const context: MiddlewareContext = {
      client,
      action: 'message',
      channel: message.channel,
      message,
      reject: (reason: string) => {
        throw new MiddlewareRejectionError(reason, 'message')
      },
    }

    await this.executeAll(context)
  }

  /**
   * Execute middleware for a subscribe action
   */
  async executeSubscribe(
    client: ServerClient,
    channel: ChannelName,
  ): Promise<void> {
    const context: MiddlewareContext = {
      client,
      action: 'subscribe',
      channel,
      message: undefined,
      reject: (reason: string) => {
        throw new MiddlewareRejectionError(reason, 'subscribe')
      },
    }

    await this.executeAll(context)
  }

  /**
   * Execute middleware for an unsubscribe action
   */
  async executeUnsubscribe(
    client: ServerClient,
    channel: ChannelName,
  ): Promise<void> {
    const context: MiddlewareContext = {
      client,
      action: 'unsubscribe',
      channel,
      message: undefined,
      reject: (reason: string) => {
        throw new MiddlewareRejectionError(reason, 'unsubscribe')
      },
    }

    await this.executeAll(context)
  }

  /**
   * Execute all middleware functions
   */
  private async executeAll(context: MiddlewareContext): Promise<void> {
    for (const mw of this.middleware) {
      await mw(context)
    }
  }
}

/**
 * Common middleware factory functions
 */

/**
 * Authentication middleware (placeholder)
 * In a real implementation, this would verify tokens, sessions, etc.
 *
 * @example
 * ```typescript
 * server.use(createAuthMiddleware({
 *   verify: async (token) => {
 *     // Verify JWT token
 *     const decoded = await verifyJWT(token)
 *     return decoded.userId
 *   }
 * }))
 * ```
 */
export function createAuthMiddleware(options: {
  verify?: (
    token: string,
  ) =>
    | Promise<string | Record<string, unknown>>
    | string
    | Record<string, unknown>
  getToken?: (client: ServerClient) => string | undefined
}): ServerMiddleware {
  return async ({ client, reject }) => {
    // Placeholder for authentication logic
    // In production, this would:
    // 1. Extract token from client (query string, header, cookie)
    // 2. Verify the token
    // 3. Attach user info to client metadata

    if (!client) {
      return
    }

    const token = options.getToken?.(client)

    if (!token) {
      // No token provided - allow anonymous access (configurable)
      return
    }

    try {
      // Verify token
      const result = await options.verify?.(token)
      if (!result) {
        reject('Authentication failed')
      }
    } catch (error) {
      reject('Authentication failed')
    }
  }
}

/**
 * Logging middleware
 * Logs all server events
 */
export function createLoggingMiddleware(options?: {
  logConnections?: boolean
  logMessages?: boolean
  logSubscriptions?: boolean
  logger?: (message: string) => void
}): ServerMiddleware {
  const logger = options?.logger ?? console.log

  return async ({ client, action, channel, message }) => {
    if (
      !options?.logConnections &&
      (action === 'connect' || action === 'disconnect')
    ) {
      return
    }
    if (!options?.logMessages && action === 'message') {
      return
    }
    if (
      !options?.logSubscriptions &&
      (action === 'subscribe' || action === 'unsubscribe')
    ) {
      return
    }

    switch (action) {
      case 'connect':
        logger(`[Synnel] Client connected: ${client?.id}`)
        break
      case 'disconnect':
        logger(`[Synnel] Client disconnected: ${client?.id}`)
        break
      case 'message':
        logger(
          `[Synnel] Message from ${client?.id} to channel ${channel}:`,
          message,
        )
        break
      case 'subscribe':
        logger(`[Synnel] ${client?.id} subscribed to ${channel}`)
        break
      case 'unsubscribe':
        logger(`[Synnel] ${client?.id} unsubscribed from ${channel}`)
        break
    }
  }
}

/**
 * Rate limiting middleware (placeholder)
 * In a real implementation, this would track and limit request rates
 */
export function createRateLimitMiddleware(options?: {
  maxMessages?: number
  windowMs?: number
}): ServerMiddleware {
  // Placeholder for rate limiting logic
  // In production, this would:
  // 1. Track message counts per client
  // 2. Reset counts after window expires
  // 3. Reject clients that exceed limits

  const limits = new Map<string, { count: number; resetAt: number }>()

  return async ({ client, action, reject }) => {
    if (action !== 'message') {
      return
    }

    if (!client) {
      return
    }

    const maxMessages = options?.maxMessages ?? 100
    const windowMs = options?.windowMs ?? 60000

    const now = Date.now()
    const limit = limits.get(client.id)

    if (!limit || now > limit.resetAt) {
      limits.set(client.id, { count: 1, resetAt: now + windowMs })
      return
    }

    limit.count++

    if (limit.count > maxMessages) {
      reject('Rate limit exceeded')
    }
  }
}

/**
 * Channel whitelist middleware
 * Enforces that clients can only subscribe to whitelisted channels
 */
export function createChannelWhitelistMiddleware(
  allowedChannels: string[],
): ServerMiddleware {
  const allowed = new Set(allowedChannels)

  return async ({ action, channel, reject }) => {
    if (action !== 'subscribe' && action !== 'message') {
      return
    }

    if (channel && !allowed.has(channel)) {
      reject(`Channel '${channel}' is not allowed`)
    }
  }
}
