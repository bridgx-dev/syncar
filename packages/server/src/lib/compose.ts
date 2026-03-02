import { MiddlewareRejectionError, MiddlewareExecutionError } from '../errors'

/**
 * Next function type
 */
export type NextFunction = () => Promise<void>

/**
 * Generic Middleware function type
 */
export type Middleware<T> = (context: T, next: NextFunction) => void | Promise<void>

/**
 * Compose multiple middleware functions into a single execution function.
 * Follows the Koa-style onion pattern.
 *
 * @param middlewares - Array of middleware functions
 * @returns A composed function that runs the onion
 *
 * @example
 * ```ts
 * const composed = compose([fn1, fn2, fn3])
 * await composed(context, finalHandler)
 * ```
 */
export function compose<T>(
    middlewares: Middleware<T>[],
): (context: T, next?: NextFunction) => Promise<void> {
    if (!Array.isArray(middlewares)) {
        throw new TypeError('Middleware stack must be an array!')
    }

    for (const fn of middlewares) {
        if (typeof fn !== 'function') {
            throw new TypeError('Middleware must be composed of functions!')
        }
    }

    /**
     * @param context
     * @param next
     * @return {Promise}
     * @api public
     */
    return function (context: T, next?: NextFunction): Promise<void> {
        // last called middleware #
        let index = -1
        return dispatch(0)

        async function dispatch(i: number): Promise<void> {
            if (i <= index) {
                throw new Error('next() called multiple times')
            }
            index = i
            let fn = middlewares[i]
            if (i === middlewares.length) {
                fn = next as any
            }
            if (!fn) return

            try {
                await fn(context, dispatch.bind(null, i + 1))
            } catch (error) {
                // If it's a rejection or already an execution error, re-throw
                if (
                    error instanceof MiddlewareRejectionError ||
                    error instanceof MiddlewareExecutionError
                ) {
                    throw error
                }

                // Wrap unexpected errors
                const middlewareName = fn.name || `middleware[${i}]`
                // We expect context to have an 'action' property for error reporting
                // If it doesn't, we use a generic label
                const action = (context as any).req?.action || (context as any).action || 'unknown'

                throw new MiddlewareExecutionError(
                    action,
                    middlewareName,
                    error instanceof Error ? error : new Error(String(error)),
                )
            }
        }
    }
}
