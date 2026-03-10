import type {
    IMiddleware,
    IClientConnection,
    ChannelName,
} from '../types'

/**
 * Channel whitelist middleware options
 */
export interface ChannelWhitelistOptions {
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
 */
export function channelWhitelist(options: ChannelWhitelistOptions = {}): IMiddleware {
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
                return c.reject(`Channel '${c.req.channel}' is not allowed`)
            }
            return next()
        }

        // Check static whitelist
        if (!allowedChannels.includes(c.req.channel)) {
            return c.reject(`Channel '${c.req.channel}' is not allowed`)
        }

        await next()
    }
}
