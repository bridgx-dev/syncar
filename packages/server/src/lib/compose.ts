import type { Context, Middleware, Next } from '../types'

/**
 * Error handler type
 */
export type ErrorHandler<S = any> = (err: Error, c: Context<S>) => any | Promise<any>

/**
 * Not found handler type
 */
export type NotFoundHandler<S = any> = (c: Context<S>) => any | Promise<any>

/**
 * Compose middleware functions into a single function.
 * Follows the Hono core execution pattern.
 *
 * @param middleware - Array of middleware functions.
 * @param onError - Optional error handler.
 * @param onNotFound - Optional not-found handler.
 * @returns A composed function that returns the finalized context.
 */
export function compose<S = any>(
    middleware: Middleware<S>[],
    onError?: ErrorHandler<S>,
    onNotFound?: NotFoundHandler<S>
): (context: Context<S>, next?: Next) => Promise<Context<S>> {
    return (context, next) => {
        let index = -1

        return dispatch(0)

        async function dispatch(i: number): Promise<Context<S>> {
            if (i <= index) {
                throw new Error('next() called multiple times')
            }
            index = i

            let res
            let isError = false
            let handler: Middleware<S> | undefined

            if (middleware[i]) {
                handler = middleware[i]
            } else {
                handler = (i === middleware.length && next) ? (next as any) : undefined
            }

            if (handler) {
                try {
                    res = await (handler as any)(context, (() => dispatch(i + 1)) as any)
                } catch (err) {
                    if (err instanceof Error && onError) {
                        context.error = err
                        res = await onError(err, context)
                        isError = true
                    } else {
                        throw err
                    }
                }
            } else {
                if (context.finalized === false && onNotFound) {
                    res = await onNotFound(context)
                }
            }

            if (res !== undefined && (context.finalized === false || isError)) {
                context.res = res
                // In Hono, if res is provided, it often implies finalization for web responses.
                // For real-time Sync, we'll let the handlers decide or set it here if res exists.
                if (res !== undefined) context.finalized = true
            }

            return context
        }
    }
}
