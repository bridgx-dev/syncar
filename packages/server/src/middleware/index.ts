/**
 * Middleware Module
 * Middleware system for processing connections, messages, and actions.
 *
 * @module middleware
 */

// ============================================================
// MIDDLEWARE MANAGER
// ============================================================

export { MiddlewareManager } from './middleware-manager.js'

// ============================================================
// MIDDLEWARE FACTORIES
// ============================================================

export {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './factories.js'

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IMiddleware,
  IMiddlewareContext,
  IMiddlewareManager,
  IMiddlewareAction,
  IMiddlewareChain,
  IComposedMiddleware,
  IActionMiddleware,
  IMiddlewareContextFactory,
} from '../types/middleware.js'

export type { IServerClient } from '../types/client.js'

export type { ChannelName, Message } from '@synnel/types'
