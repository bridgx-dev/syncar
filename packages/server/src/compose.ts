import type { Context, Middleware, Next } from './types'

/**
 * Compose middleware functions into a single function.
 * Follows the Hono/Koa onion-style execution pattern.
 */
export const compose = <S = Record<string, unknown>>(middleware: Middleware<S>[]) => {
    return (context: Context<S>, next?: Next) => {
        let index = -1

        const dispatch = async (i: number): Promise<Context<S>> => {
            if (i <= index) throw new Error('next() called multiple times')
            index = i

            let res: unknown
            const handler = middleware[i]

            if (handler) {
                res = await handler(context, async () => { await dispatch(i + 1) })
            } else if (i === middleware.length && next) {
                res = await next()
            } else {
                return context
            }

            if (res !== undefined && !context.finalized) {
                context.res = res
                context.finalized = true
            }

            return context
        }

        return dispatch(0)
    }
}
