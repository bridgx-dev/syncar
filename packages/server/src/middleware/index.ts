/**
 * Middleware Module
 * Middleware system for processing connections, messages, and actions.
 *
 * @module middleware
 */

export { MiddlewareManager } from './middleware-manager'
export {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
  clearRateLimitStore,
  getRateLimitState,
} from './factories'
