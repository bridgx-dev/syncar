import type { IMiddleware, Context, IMiddlewareAction } from '../types'

/**
 * Auth middleware options
 */
export interface AuthOptions {
    /**
     * Verify and decode a token
     * Returns the user data to attach to the client
     */
    verifyToken: (token: string) => Promise<unknown> | unknown

    /**
     * Extract token from the middleware context
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
 */
export function authenticate(options: AuthOptions): IMiddleware {
    const {
        verifyToken,
        getToken = (c) => {
            // Default: extract token from message.data.token
            const msg = c.req.message as
                | { data?: { token?: string } }
                | undefined
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
            return c.reject('Authentication token required')
        }

        // Verify token
        try {
            const userData = await verifyToken(token!)

            // Attach user data to client (LEGACY - for compatibility)
            if (c.req.client) {
                ;(c.req.client as unknown as Record<string, unknown>)[
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
