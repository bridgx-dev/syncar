/**
 * Middleware Module
 * Middleware system for processing connections, messages, and actions.
 *
 * @module middleware
 */

export { authenticate, type AuthOptions } from './authenticate'
export { logger, type LoggingOptions } from './logger'
export {
    rateLimit,
    type RateLimitOptions,
    clearRateLimitStore,
    getRateLimitState,
} from './rate-limit'
export {
    channelWhitelist,
    type ChannelWhitelistOptions,
} from './channel-whitelist'
