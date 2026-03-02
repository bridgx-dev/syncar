import { MiddlewareRejectionError } from './errors'
import { compose } from './lib'
import type {
    Context,
    IMiddlewareAction,
    IClientConnection,
    Message,
    ChannelName,
    IMiddleware,
    IContextManager,
    IMiddlewareContextFactory,
} from './types'

/**
 * Context Data Options
 */
export interface ContextOptions<S = any> {
    action: IMiddlewareAction
    client?: IClientConnection
    message?: Message
    channel?: ChannelName
    initialState?: S
}

/**
 * Create a new Hono-style middleware context.
 * Uses closures to ensure properties can be destructured safely.
 *
 * @param options - Context initialization options
 * @returns A lightweight Context object
 */
export function createContext<S = Record<string, any>>(
    options: ContextOptions<S>,
): Context<S> {
    const { action, client, message, channel, initialState = {} as S } = options
    const state = initialState as S

    return {
        req: {
            action,
            client,
            message,
            channel,
        },

        var: state,

        state, // Legacy compatibility

        get: <K extends keyof S>(key: K): S[K] => {
            return state[key]
        },

        set: <K extends keyof S>(key: K, value: S[K]): void => {
            state[key] = value
        },

        reject: (reason: string): never => {
            throw new MiddlewareRejectionError(reason, action)
        },
    }
}

/**
 * Context Manager - manages and executes middleware functions
 */
export class ContextManager
    implements IContextManager, IMiddlewareContextFactory {
    protected readonly middlewares: IMiddleware[] = []

    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    remove(middleware: IMiddleware): boolean {
        const index = this.middlewares.indexOf(middleware)
        if (index !== -1) {
            this.middlewares.splice(index, 1)
            return true
        }
        return false
    }

    clear(): void {
        this.middlewares.length = 0
    }

    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    async executeConnection(
        client: IClientConnection,
        action: 'connect' | 'disconnect',
    ): Promise<void> {
        const c = this.createConnectionContext(client, action)
        await compose(this.middlewares)(c)
    }

    async executeMessage(
        client: IClientConnection,
        message: Message,
    ): Promise<void> {
        const c = this.createMessageContext(client, message)
        await compose(this.middlewares)(c)
    }

    async executeSubscribe(
        client: IClientConnection,
        channel: ChannelName,
        finalHandler?: () => Promise<void>,
    ): Promise<void> {
        const c = this.createSubscribeContext(client, channel)
        await compose(this.middlewares)(c, finalHandler)
    }

    async executeUnsubscribe(
        client: IClientConnection,
        channel: ChannelName,
        finalHandler?: () => Promise<void>,
    ): Promise<void> {
        const c = this.createUnsubscribeContext(client, channel)
        await compose(this.middlewares)(c, finalHandler)
    }

    async execute(
        context: Context,
        middlewares: IMiddleware[] = this.middlewares,
        finalHandler?: () => Promise<void>,
    ): Promise<void> {
        await compose(middlewares)(context, finalHandler)
    }

    createConnectionContext(
        client: IClientConnection,
        action: 'connect' | 'disconnect',
    ): Context {
        return createContext({
            client,
            action,
        })
    }

    createMessageContext(
        client: IClientConnection,
        message: Message,
    ): Context {
        return createContext({
            client,
            message,
            action: 'message',
        })
    }

    createSubscribeContext(
        client: IClientConnection,
        channel: ChannelName,
    ): Context {
        return createContext({
            client,
            channel,
            action: 'subscribe',
        })
    }

    createUnsubscribeContext(
        client: IClientConnection,
        channel: ChannelName,
    ): Context {
        return createContext({
            client,
            channel,
            action: 'unsubscribe',
        })
    }

    getCount(): number {
        return this.middlewares.length
    }

    hasMiddleware(): boolean {
        return this.middlewares.length > 0
    }
}
