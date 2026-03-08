import { MiddlewareRejectionError, MiddlewareExecutionError } from './errors'
import { compose } from './compose'
import type {
    Context,
    IMiddlewareAction,
    IClientConnection,
    Message,
    ChannelName,
    IMiddleware,
} from './types'

/**
 * Context Data Options
 *
 * @remarks
 * Options for creating a new middleware context with pre-populated state.
 *
 * @template S - Type of the state object (default: Record<string, unknown>)
 *
 * @property action - The middleware action being performed
 * @property client - Optional client connection
 * @property message - Optional message being processed
 * @property channel - Optional channel name
 * @property initialState - Optional initial state values
 *
 * @example
 * ```ts
 * const options: ContextOptions<{ user: UserInfo }> = {
 *   action: 'message',
 *   client: connection,
 *   message: dataMessage,
 *   channel: 'chat',
 *   initialState: { user: { id: '123', name: 'Alice' } }
 * }
 * ```
 */
export interface ContextOptions<S = Record<string, unknown>> {
    /** The middleware action being performed */
    action: IMiddlewareAction
    /** Optional client connection */
    client?: IClientConnection
    /** Optional message being processed */
    message?: Message
    /** Optional channel name */
    channel?: ChannelName
    /** Optional initial state values */
    initialState?: S
}

/**
 * Create a new Hono-style middleware context
 *
 * @remarks
 * Creates a lightweight middleware context using closures to ensure properties
 * can be destructured safely. The context provides access to request information,
 * state management, and control flow methods.
 *
 * @template S - Type of the state object (default: Record<string, unknown>)
 *
 * @param options - Context initialization options
 * @returns A new Context object
 *
 * @example
 * ### Basic usage
 * ```ts
 * const context = createContext({
 *   action: 'message',
 *   client: connection,
 *   message: dataMessage,
 *   channel: 'chat'
 * })
 * ```
 *
 * @example
 * ### With initial state
 * ```ts
 * interface AppState {
 *   user: { id: string; name: string }
 *   requestId: string
 * }
 *
 * const context = createContext<AppState>({
 *   action: 'message',
 *   initialState: {
 *     user: { id: '123', name: 'Alice' },
 *     requestId: generateId()
 *   }
 * })
 *
 * // Access state
 * const user = context.get('user')
 * const requestId = context.get('requestId')
 * ```
 *
 * @see {@link Context} for the context interface
 */
export function createContext<S = Record<string, unknown>>(
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
        finalized: false,

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
 *
 * @remarks
 * The ContextManager is responsible for registering middleware functions
 * and executing them in the correct order for various actions (connect,
 * disconnect, message, subscribe, unsubscribe).
 *
 * Key features:
 * - Global middleware registration
 * - Per-action middleware execution
 * - Channel-specific middleware support
 * - Automatic error wrapping and reporting
 *
 * @example
 * ```ts
 * import { ContextManager } from '@syncar/server'
 *
 * const manager = new ContextManager()
 *
 * // Register middleware
 * manager.use(async (context, next) => {
 *   console.log(`Action: ${context.req.action}`)
 *   await next()
 * })
 *
 * // Execute middleware for an action
 * const context = await manager.executeConnection(client, 'connect')
 * ```
 *
 * @see {@link createSyncarServer} for server-level context management
 */
export class ContextManager {
    /** Registered middleware functions */
    protected readonly middlewares: IMiddleware[] = []

    /**
     * Register a middleware function
     *
     * @remarks
     * Adds a middleware function to the global middleware chain.
     * Middleware is executed in the order it is registered.
     *
     * @param middleware - The middleware function to register
     *
     * @example
     * ```ts
     * manager.use(async (context, next) => {
     *   console.log('Before')
     *   await next()
     *   console.log('After')
     * })
     * ```
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Remove a middleware function
     *
     * @remarks
     * Removes a previously registered middleware function from the chain.
     *
     * @param middleware - The middleware function to remove
     * @returns `true` if the middleware was found and removed, `false` otherwise
     *
     * @example
     * ```ts
     * const middleware = async (context, next) => { /* ... *\/ }
     * manager.use(middleware)
     *
     * // Later, remove it
     * if (manager.remove(middleware)) {
     *   console.log('Middleware removed')
     * }
     * ```
     */
    remove(middleware: IMiddleware): boolean {
        const index = this.middlewares.indexOf(middleware)
        if (index !== -1) {
            this.middlewares.splice(index, 1)
            return true
        }
        return false
    }

    /**
     * Clear all middleware
     *
     * @remarks
     * Removes all registered middleware functions from the chain.
     *
     * @example
     * ```ts
     * manager.clear()
     * console.log('All middleware cleared')
     * ```
     */
    clear(): void {
        this.middlewares.length = 0
    }

    /**
     * Get all registered middleware
     *
     * @remarks
     * Returns a shallow copy of the middleware array to prevent
     * external modification.
     *
     * @returns Array of middleware functions
     *
     * @example
     * ```ts
     * const allMiddleware = manager.getMiddlewares()
     * console.log(`Registered middleware: ${allMiddleware.length}`)
     * ```
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Get the complete middleware pipeline
     *
     * @remarks
     * Returns the combined middleware pipeline including global middleware
     * and any channel-specific middleware from the provided channel instance.
     *
     * @param channelInstance - Optional channel instance with middleware
     * @returns Combined array of middleware functions
     *
     * @example
     * ```ts
     * const chat = server.createMulticast('chat')
     * const pipeline = manager.getPipeline(chat)
     * // Returns global middleware + chat channel middleware
     * ```
     *
     * @internal
     */
    getPipeline(channelInstance?: { getMiddlewares?: () => IMiddleware[] }): IMiddleware[] {
        let pipeline = this.getMiddlewares()
        const channelMiddlewares = channelInstance?.getMiddlewares?.()

        if (channelMiddlewares && channelMiddlewares.length > 0) {
            pipeline = [...pipeline, ...channelMiddlewares]
        }

        return pipeline
    }

    /**
     * Execute middleware for connection actions
     *
     * @remarks
     * Creates a connection context and executes the middleware pipeline
     * for connect or disconnect actions.
     *
     * @param client - The client connection
     * @param action - The action ('connect' or 'disconnect')
     * @returns The executed context
     *
     * @example
     * ```ts
     * await manager.executeConnection(client, 'connect')
     * await manager.executeConnection(client, 'disconnect')
     * ```
     *
     * @internal
     */
    async executeConnection(
        client: IClientConnection,
        action: 'connect' | 'disconnect',
    ): Promise<Context> {
        const c = this.createConnectionContext(client, action)
        return await this.execute(c)
    }

    /**
     * Execute middleware for message actions
     *
     * @remarks
     * Creates a message context and executes the middleware pipeline
     * for incoming client messages.
     *
     * @param client - The client connection
     * @param message - The message being processed
     * @returns The executed context
     *
     * @example
     * ```ts
     * await manager.executeMessage(client, dataMessage)
     * ```
     *
     * @internal
     */
    async executeMessage(
        client: IClientConnection,
        message: Message,
    ): Promise<Context> {
        const c = this.createMessageContext(client, message)
        return await this.execute(c)
    }

    /**
     * Execute middleware for subscribe actions
     *
     * @remarks
     * Creates a subscribe context and executes the middleware pipeline
     * for channel subscription requests.
     *
     * @param client - The client connection
     * @param channel - The channel name
     * @param finalHandler - Optional final handler to execute after middleware
     * @returns The executed context
     *
     * @example
     * ```ts
     * await manager.executeSubscribe(client, 'chat', async () => {
     *   // Final handler - perform the actual subscription
     *   channel.subscribe(client.id)
     * })
     * ```
     *
     * @internal
     */
    async executeSubscribe(
        client: IClientConnection,
        channel: ChannelName,
        finalHandler?: () => Promise<void>,
    ): Promise<Context> {
        const c = this.createSubscribeContext(client, channel)
        return await this.execute(c, this.middlewares, finalHandler)
    }

    /**
     * Execute middleware for unsubscribe actions
     *
     * @remarks
     * Creates an unsubscribe context and executes the middleware pipeline
     * for channel unsubscription requests.
     *
     * @param client - The client connection
     * @param channel - The channel name
     * @param finalHandler - Optional final handler to execute after middleware
     * @returns The executed context
     *
     * @example
     * ```ts
     * await manager.executeUnsubscribe(client, 'chat', async () => {
     *   // Final handler - perform the actual unsubscription
     *   channel.unsubscribe(client.id)
     * })
     * ```
     *
     * @internal
     */
    async executeUnsubscribe(
        client: IClientConnection,
        channel: ChannelName,
        finalHandler?: () => Promise<void>,
    ): Promise<Context> {
        const c = this.createUnsubscribeContext(client, channel)
        return await this.execute(c, this.middlewares, finalHandler)
    }

    /**
     * Execute middleware pipeline
     *
     * @remarks
     * Executes the provided middleware functions in order, wrapping
     * each to capture and report errors appropriately.
     *
     * @param context - The middleware context
     * @param middlewares - The middleware functions to execute (defaults to registered middleware)
     * @param finalHandler - Optional final handler to execute after all middleware
     * @returns The executed context
     *
     * @throws {MiddlewareExecutionError} If a middleware function throws an unexpected error
     *
     * @example
     * ```ts
     * const context = createContext({ action: 'message' })
     * await manager.execute(context)
     * ```
     *
     * @internal
     */
    async execute(
        context: Context,
        middlewares: IMiddleware[] = this.middlewares,
        finalHandler?: () => Promise<void>,
    ): Promise<Context> {
        const action = context.req.action || 'unknown'

        // Wrap middlewares to capture specific execution errors
        const wrappedMiddlewares = middlewares.map((mw, i) => {
            return async (ctx: Context, next: () => Promise<void>) => {
                try {
                    await mw(ctx, next)
                } catch (error) {
                    // Re-throw if already handled or explicit rejection
                    if (
                        error instanceof MiddlewareRejectionError ||
                        error instanceof MiddlewareExecutionError
                    ) {
                        throw error
                    }

                    const middlewareName = mw.name || `middleware[${i}]`
                    throw new MiddlewareExecutionError(
                        action,
                        middlewareName,
                        error instanceof Error ? error : new Error(String(error)),
                    )
                }
            }
        })

        return await compose(wrappedMiddlewares)(context, finalHandler as () => Promise<void>)
    }

    /**
     * Create a connection context
     *
     * @remarks
     * Creates a middleware context for connection or disconnect actions.
     *
     * @param client - The client connection
     * @param action - The action ('connect' or 'disconnect')
     * @returns A new connection context
     *
     * @example
     * ```ts
     * const context = manager.createConnectionContext(client, 'connect')
     * ```
     *
     * @internal
     */
    createConnectionContext(
        client: IClientConnection,
        action: 'connect' | 'disconnect',
    ): Context {
        return createContext({
            client,
            action,
        })
    }

    /**
     * Create a message context
     *
     * @remarks
     * Creates a middleware context for message processing.
     *
     * @param client - The client connection
     * @param message - The message being processed
     * @returns A new message context
     *
     * @example
     * ```ts
     * const context = manager.createMessageContext(client, dataMessage)
     * ```
     *
     * @internal
     */
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

    /**
     * Create a subscribe context
     *
     * @remarks
     * Creates a middleware context for channel subscription.
     *
     * @param client - The client connection
     * @param channel - The channel name
     * @returns A new subscribe context
     *
     * @example
     * ```ts
     * const context = manager.createSubscribeContext(client, 'chat')
     * ```
     *
     * @internal
     */
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

    /**
     * Create an unsubscribe context
     *
     * @remarks
     * Creates a middleware context for channel unsubscription.
     *
     * @param client - The client connection
     * @param channel - The channel name
     * @returns A new unsubscribe context
     *
     * @example
     * ```ts
     * const context = manager.createUnsubscribeContext(client, 'chat')
     * ```
     *
     * @internal
     */
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

    /**
     * Get the number of registered middleware
     *
     * @returns The count of middleware functions
     *
     * @example
     * ```ts
     * console.log(`Middleware count: ${manager.getCount()}`)
     * ```
     */
    getCount(): number {
        return this.middlewares.length
    }

    /**
     * Check if any middleware is registered
     *
     * @returns `true` if at least one middleware is registered, `false` otherwise
     *
     * @example
     * ```ts
     * if (manager.hasMiddleware()) {
     *   console.log('Middleware is configured')
     * }
     * ```
     */
    hasMiddleware(): boolean {
        return this.middlewares.length > 0
    }
}
