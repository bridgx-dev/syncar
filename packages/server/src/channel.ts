import {
    type ChannelName,
    type ClientId,
    type SubscriberId,
    type DataMessage,
    type IClientConnection,
    type IMiddleware,
} from './types'

/**
 * Channel state information
 *
 * @remarks
 * Provides runtime information about a channel including its name,
 * subscriber count, creation time, and last message timestamp.
 *
 * @property name - The channel name
 * @property subscriberCount - Current number of subscribers
 * @property createdAt - Unix timestamp (ms) when the channel was created
 * @property lastMessageAt - Unix timestamp (ms) of the last published message
 *
 * @example
 * ```ts
 * const state: IChannelState = {
 *   name: 'chat',
 *   subscriberCount: 42,
 *   createdAt: 1699123456789,
 *   lastMessageAt: 1699123459999
 * }
 * ```
 */
export interface IChannelState {
    /** The channel name */
    name: string
    /** Current number of subscribers */
    subscriberCount: number
    /** Unix timestamp (ms) when the channel was created */
    createdAt: number
    /** Unix timestamp (ms) of the last published message */
    lastMessageAt?: number
}

/**
 * Publish options for channel messages
 *
 * @remarks
 * Controls which clients receive a published message through
 * inclusion/exclusion filtering.
 *
 * @property to - Optional list of client IDs to receive the message (exclusive mode)
 * @property exclude - Optional list of client IDs to exclude from receiving the message
 *
 * @example
 * ```ts
 * // Send to specific clients only
 * channel.publish('Hello', { to: ['client-1', 'client-2'] })
 *
 * // Send to all except specific clients
 * channel.publish('Hello', { exclude: ['client-123'] })
 *
 * // Both options can be combined (to takes precedence)
 * channel.publish('Hello', { to: ['client-1'], exclude: ['client-2'] })
 * ```
 */
export interface IPublishOptions {
    /**
     * Optional list of client IDs to receive the message
     *
     * @remarks
     * When provided, only clients in this list will receive the message.
     * This creates an "exclusive mode" where `exclude` is still applied
     * as a secondary filter.
     */
    to?: readonly ClientId[]
    /**
     * Optional list of client IDs to exclude from receiving the message
     *
     * @remarks
     * Clients in this list will not receive the message, even if they
     * are subscribed to the channel. Useful for excluding the sender.
     */
    exclude?: readonly ClientId[]
}

/**
 * Base message handler signature
 *
 * @remarks
 * Type-safe handler function for processing incoming messages on a channel.
 * Handlers receive the message data, sending client, and the original message object.
 *
 * @template T - Type of data expected in messages
 *
 * @example
 * ```ts
 * const handler: IMessageHandler<{ text: string }> = (data, client, message) => {
 *   console.log(`${client.id} sent: ${data.text}`)
 *   console.log(`Message ID: ${message.id}`)
 * }
 *
 * channel.onMessage(handler)
 * ```
 */
export type IMessageHandler<T> = (
    /** The message data payload */
    data: T,
    /** The client connection that sent the message */
    client: IClientConnection,
    /** The complete message object with metadata */
    message: DataMessage<T>,
) => void | Promise<void>

import { createDataMessage, assertValidChannelName } from './utils'
import { ClientRegistry } from './registry'
import { BROADCAST_CHANNEL } from './config'

/**
 * Base Channel implementation
 *
 * @remarks
 * Abstract base class for all channel types. Handles the complexities of
 * chunked publishing, client filtering, and message delivery. Provides
 * automatic chunking for large broadcasts to avoid event loop blocking.
 *
 * @template T - Type of data published on this channel (default: unknown)
 * @template N - Type of the channel name (default: ChannelName)
 *
 * @example
 * ```ts
 * // Extend BaseChannel for custom channel types
 * class CustomChannel<T> extends BaseChannel<T> {
 *   get subscriberCount() { return 0 }
 *   isEmpty() { return true }
 *   getMiddlewares() { return [] }
 *   protected getTargetClients() { return [] }
 * }
 * ```
 *
 * @see {@link BroadcastChannel} for channel that sends to all clients
 * @see {@link MulticastChannel} for channel that sends to subscribers only
 */
export abstract class BaseChannel<
    T = unknown,
    N extends ChannelName = ChannelName,
> {
    /**
     * Creates a new BaseChannel instance
     *
     * @param name - The channel name
     * @param registry - The client registry for connection management
     * @param chunkSize - Number of clients to process per chunk for large broadcasts (default: 500)
     */
    constructor(
        /** The channel name */
        public readonly name: N,
        /** The client registry for connection management */
        protected readonly registry: ClientRegistry,
        /** Number of clients to process per chunk for large broadcasts (default: 500) */
        protected readonly chunkSize: number = 500,
    ) { }

    /**
     * Get the current subscriber count
     *
     * @remarks
     * Abstract method that must be implemented by subclasses.
     * Returns the number of clients currently receiving messages from this channel.
     */
    abstract get subscriberCount(): number

    /**
     * Check if the channel has no subscribers
     *
     * @remarks
     * Abstract method that must be implemented by subclasses.
     * Returns `true` if the channel has no subscribers.
     */
    abstract isEmpty(): boolean

    /**
     * Get the middleware for this channel
     *
     * @remarks
     * Abstract method that must be implemented by subclasses.
     * Returns an array of middleware functions applied to this channel.
     */
    abstract getMiddlewares(): IMiddleware[]

    /**
     * Publish data to the channel
     *
     * @remarks
     * Sends the data to all target clients. If the number of clients exceeds
     * `chunkSize`, messages are sent in chunks using `setImmediate` to avoid
     * blocking the event loop.
     *
     * @param data - The data to publish
     * @param options - Optional publish options for client filtering
     *
     * @example
     * ```ts
     * // Publish to all clients
     * channel.publish('Hello everyone!')
     *
     * // Publish excluding specific clients
     * channel.publish('Hello', { exclude: ['client-123'] })
     *
     * // Publish to specific clients only
     * channel.publish('Private message', { to: ['client-1', 'client-2'] })
     * ```
     */
    publish(data: T, options?: IPublishOptions): void {
        const clients = this.getTargetClients(options)
        if (clients.length > this.chunkSize) {
            this.publishInChunks(data, clients, options)
        } else {
            this.publishToClients(data, clients, options)
        }
    }

    /**
     * Dispatch an incoming client message
     *
     * @remarks
     * Called when a client sends a message to this channel.
     * Override in subclasses to handle incoming messages.
     * Default implementation is a no-op (e.g., BroadcastChannel doesn't receive messages).
     *
     * @param data - The message data
     * @param client - The client that sent the message
     * @param message - The complete message object
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async dispatch(_data: T, _client: IClientConnection, _message: DataMessage<T>): Promise<void> { }

    protected abstract getTargetClients(options?: IPublishOptions): ClientId[]

    protected publishToClients(
        data: T,
        clientIds: ClientId[],
        options?: IPublishOptions,
    ): void {
        const message = createDataMessage<T>(this.name, data)

        for (const clientId of clientIds) {
            // Apply filters (if present in options)
            if (options?.to && !options.to.includes(clientId)) continue
            if (options?.exclude && options.exclude.includes(clientId)) continue

            const client = this.registry.connections.get(clientId)
            if (client) {
                try {
                    client.socket.send(JSON.stringify(message))
                } catch (error) {
                    this.registry.logger?.error(`[${this.name}] Failed to send to ${clientId}:`, error as Error)
                }
            }
        }
    }

    protected publishInChunks(
        data: T,
        clientIds: ClientId[],
        options?: IPublishOptions,
    ): void {
        let index = 0

        const nextChunk = () => {
            const chunk = clientIds.slice(index, index + this.chunkSize)
            if (chunk.length === 0) return

            this.publishToClients(data, chunk, options)
            index += this.chunkSize

            if (index < clientIds.length) {
                setImmediate(nextChunk)
            }
        }
        nextChunk()
    }
}

/**
 * Broadcast Channel - sends messages to ALL connected clients
 *
 * @remarks
 * A special channel that delivers messages to every connected client,
 * regardless of subscription. This is useful for server-wide announcements,
 * system notifications, and global events.
 *
 * The broadcast channel is a singleton with the reserved name `__broadcast__`.
 * It is automatically created when the server starts and can be accessed
 * via `server.createBroadcast()`.
 *
 * @template T - Type of data to be broadcast (default: unknown)
 *
 * @example
 * ### Basic broadcasting
 * ```ts
 * const broadcast = server.createBroadcast<string>()
 * broadcast.publish('Server maintenance in 5 minutes')
 * ```
 *
 * @example
 * ### Broadcasting objects
 * ```ts
 * const alerts = server.createBroadcast<{ type: string; message: string }>()
 * alerts.publish({ type: 'warning', message: 'High load detected' })
 * ```
 *
 * @example
 * ### Client filtering
 * ```ts
 * // Send to all except specific clients
 * broadcast.publish('Admin message', { exclude: ['client-123'] })
 *
 * // Send to specific clients only
 * broadcast.publish('Private message', { to: ['client-1', 'client-2'] })
 * ```
 *
 * @example
 * ### System announcements
 * ```ts
 * const broadcast = server.createBroadcast<string>()
 *
 * // Send periodic announcements
 * setInterval(() => {
 *   const time = new Date().toLocaleTimeString()
 *   broadcast.publish(`Server time: ${time}`)
 * }, 60000)
 * ```
 *
 * @see {@link BROADCAST_CHANNEL} for the reserved channel name constant
 * @see {@link MulticastChannel} for subscription-based channels
 */
export class BroadcastChannel<T = unknown>
    extends BaseChannel<T, typeof BROADCAST_CHANNEL> {
    /**
     * Creates a new BroadcastChannel instance
     *
     * @remarks
     * BroadcastChannel is created automatically by the server and typically
     * accessed via `server.createBroadcast()` rather than instantiated directly.
     *
     * @param registry - The client registry for connection management
     * @param chunkSize - Number of clients to process per chunk for large broadcasts (default: 500)
     */
    constructor(registry: ClientRegistry, chunkSize: number = 500) {
        super(BROADCAST_CHANNEL, registry, chunkSize)
    }

    /**
     * Get all connected clients as target recipients
     *
     * @remarks
     * Broadcast channel targets ALL connected clients. The `options` parameter
     * is still applied after this method returns for filtering.
     *
     * @param _options - Publish options (ignored for broadcast target selection)
     * @returns Array of all connected client IDs
     *
     * @internal
     */
    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        return Array.from(this.registry.connections.keys())
    }

    /**
     * Get the number of connected clients
     *
     * @returns The total number of connected clients
     *
     * @example
     * ```ts
     * const broadcast = server.createBroadcast<string>()
     * console.log(`Connected clients: ${broadcast.subscriberCount}`)
     * ```
     */
    get subscriberCount(): number {
        return this.registry.connections.size
    }

    /**
     * Check if there are no connected clients
     *
     * @returns `true` if no clients are connected, `false` otherwise
     *
     * @example
     * ```ts
     * const broadcast = server.createBroadcast<string>()
     * if (broadcast.isEmpty()) {
     *   console.log('No clients connected')
     * }
     * ```
     */
    isEmpty(): boolean {
        return this.registry.connections.size === 0
    }

    /**
     * Get the middleware for this channel
     *
     * @remarks
     * Broadcast channel has no middleware by default. Returns an empty array.
     *
     * @returns Empty array (broadcast channels don't have middleware)
     */
    getMiddlewares(): IMiddleware[] {
        return []
    }
}

/**
 * Multicast channel options
 *
 * @remarks
 * Configuration options for creating a multicast channel.
 *
 * @property chunkSize - Number of clients to process per chunk for large broadcasts
 *
 * @example
 * ```ts
 * const chat = server.createMulticast('chat', { chunkSize: 1000 })
 * ```
 */
export interface MulticastChannelOptions {
    /**
     * Number of clients to process per chunk for large broadcasts
     *
     * @remarks
     * When broadcasting to more than this many subscribers, messages are sent
     * in chunks to avoid blocking the event loop.
     *
     * @default 500
     */
    chunkSize?: number
}

/**
 * Multicast Channel - sends messages to subscribed clients only
 *
 * @remarks
 * A topic-based channel that delivers messages only to clients that have
 * explicitly subscribed. This is the standard channel type for implementing
 * chat rooms, notifications, and other subscription-based messaging patterns.
 *
 * Key features:
 * - Clients must subscribe to receive messages
 * - Supports message handlers for intercepting incoming messages
 * - Auto-relays messages to all subscribers (excluding sender) when no handler is set
 * - Supports per-channel middleware
 *
 * @template T - Type of data published on this channel (default: unknown)
 *
 * @example
 * ### Creating a channel
 * ```ts
 * const chat = server.createMulticast<{ text: string; user: string }>('chat')
 * ```
 *
 * @example
 * ### Publishing messages
 * ```ts
 * // Publish to all subscribers
 * chat.publish({ text: 'Hello everyone!', user: 'Alice' })
 *
 * // Publish excluding sender
 * chat.publish({ text: 'Welcome!', user: 'System' }, { exclude: ['client-123'] })
 *
 * // Publish to specific subscribers only
 * chat.publish({ text: 'Private message', user: 'Bob' }, { to: ['client-1'] })
 * ```
 *
 * @example
 * ### Handling incoming messages with auto-relay
 * ```ts
 * // When no handler is set, messages are auto-relayed to all subscribers (excluding sender)
 * // This is the default behavior for simple chat rooms
 * ```
 *
 * @example
 * ### Handling incoming messages with custom handler
 * ```ts
 * chat.onMessage((data, client) => {
 *   console.log(`${data.user} (${client.id}): ${data.text}`)
 *
 *   // Apply custom logic (filtering, transformation, persistence, etc.)
 *   if (isProfane(data.text)) {
 *     return // Don't relay
 *   }
 *
 *   // Manually publish to subscribers
 *   chat.publish(data, { exclude: [client.id] })
 * })
 * ```
 *
 * @example
 * ### Managing subscriptions
 * ```ts
 * // Subscribe a client
 * chat.subscribe('client-123')
 *
 * // Unsubscribe a client
 * chat.unsubscribe('client-123')
 *
 * // Check if subscribed
 * if (chat.hasSubscriber('client-123')) {
 *   console.log('Client is subscribed')
 * }
 *
 * // Get all subscribers
 * const subscribers = chat.getSubscribers()
 * console.log(`Subscribers: ${Array.from(subscribers).join(', ')}`)
 * ```
 *
 * @example
 * ### Channel middleware
 * ```ts
 * chat.use(async (context, next) => {
 *   if (context.req.action === 'message') {
 *     // Filter profanity
 *     const data = context.req.message?.data as { text: string }
 *     if (data?.text && isProfane(data.text)) {
 *       context.reject('Profanity is not allowed')
 *     }
 *   }
 *   await next()
 * })
 * ```
 *
 * @see {@link BroadcastChannel} for broadcasting to all clients
 */
export class MulticastChannel<T = unknown>
    extends BaseChannel<T> {
    private readonly middlewares: IMiddleware[] = []

    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()

    /**
     * Creates a new MulticastChannel instance
     *
     * @remarks
     * MulticastChannel is typically created via `server.createMulticast()`
     * rather than instantiated directly.
     *
     * @param config.name - The channel name (must not start with `__`)
     * @param config.registry - The client registry for connection management
     * @param config.options - Optional channel configuration
     *
     * @throws {ValidationError} If the channel name is invalid (starts with `__`)
     */
    constructor(config: {
        /** The channel name (must not start with `__`) */
        name: ChannelName
        /** The client registry for connection management */
        registry: ClientRegistry
        /** Optional channel configuration */
        options?: MulticastChannelOptions
    }) {
        assertValidChannelName(config.name)
        super(config.name, config.registry, config.options?.chunkSize)
    }

    /**
     * Get all subscribed clients as target recipients
     *
     * @remarks
     * Only clients that have subscribed to this channel will receive messages.
     * The `options` parameter is still applied after this method returns for filtering.
     *
     * @param _options - Publish options (ignored for multicast target selection)
     * @returns Array of subscribed client IDs
     *
     * @internal
     */
    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        return Array.from(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Register a channel-specific middleware
     *
     * @remarks
     * Adds a middleware function that runs for all actions on this channel,
     * after global middleware. Channel middleware is useful for channel-specific
     * validation, filtering, or enrichment.
     *
     * @param middleware - The middleware function to register
     *
     * @example
     * ```ts
     * chat.use(async (context, next) => {
     *   if (context.req.action === 'message') {
     *     const data = context.req.message?.data as { text: string }
     *     if (data?.text && isProfane(data.text)) {
     *       context.reject('Profanity is not allowed')
     *     }
     *   }
     *   await next()
     * })
     * ```
     *
     * @see {@link IMiddleware} for middleware interface
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Get the middleware for this channel
     *
     * @returns Array of middleware functions registered on this channel
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Get the number of subscribers
     *
     * @returns The number of clients subscribed to this channel
     *
     * @example
     * ```ts
     * console.log(`Chat subscribers: ${chat.subscriberCount}`)
     * ```
     */
    get subscriberCount(): number {
        return this.registry.getChannelSubscribers(this.name).size
    }

    /**
     * Register a message handler for incoming messages
     *
     * @remarks
     * Registers a handler that intercepts incoming messages to this channel.
     * When handlers are registered, they receive full control over message
     * processing - auto-relay is disabled.
     *
     * @param handler - The message handler function
     * @returns Unsubscribe function that removes the handler when called
     *
     * @example
     * ```ts
     * const unsubscribe = chat.onMessage((data, client) => {
     *   console.log(`${client.id}: ${data.text}`)
     *   // Custom processing logic
     * })
     *
     * // Later, remove the handler
     * unsubscribe()
     * ```
     *
     * @remarks
     * Multiple handlers can be registered. They will be executed in the order
     * they were registered. If any handler throws an error, it will be logged
     * but other handlers will still execute.
     */
    onMessage(handler: IMessageHandler<T>): () => void {
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    /**
     * Subscribe a client to this channel
     *
     * @remarks
     * Subscribes a client to receive messages from this channel.
     * This is typically called automatically when a client sends a
     * subscribe signal, but can also be called manually.
     *
     * @param subscriber - The subscriber (client) ID to subscribe
     * @returns `true` if subscription was successful, `false` if already subscribed
     *
     * @example
     * ```ts
     * chat.subscribe('client-123')
     *
     * if (chat.subscribe('client-456')) {
     *   console.log('Subscribed successfully')
     * }
     * ```
     */
    subscribe(subscriber: SubscriberId): boolean {
        return this.registry.subscribe(subscriber, this.name)
    }

    /**
     * Unsubscribe a client from this channel
     *
     * @remarks
     * Removes a client's subscription from this channel.
     * This is typically called automatically when a client sends an
     * unsubscribe signal or disconnects, but can also be called manually.
     *
     * @param subscriber - The subscriber (client) ID to unsubscribe
     * @returns `true` if unsubscription was successful, `false` if not subscribed
     *
     * @example
     * ```ts
     * chat.unsubscribe('client-123')
     *
     * if (chat.unsubscribe('client-456')) {
     *   console.log('Unsubscribed successfully')
     * }
     * ```
     */
    unsubscribe(subscriber: SubscriberId): boolean {
        return this.registry.unsubscribe(subscriber, this.name)
    }

    /**
     * Dispatch an incoming client message
     *
     * @remarks
     * Processes incoming messages from clients. The behavior depends on
     * whether message handlers are registered:
     *
     * - **With handlers**: All registered handlers are executed with full
     *   control over the message. No auto-relay occurs.
     *
     * - **Without handlers**: The message is automatically relayed to all
     *   subscribers except the sender.
     *
     * @param data - The message data payload
     * @param client - The client that sent the message
     * @param message - The complete message object
     *
     * @example
     * ### Auto-relay mode (no handler)
     * ```ts
     * // Client sends message → automatically relayed to all subscribers
     * // No need to call publish()
     * ```
     *
     * @example
     * ### Intercept mode (with handler)
     * ```ts
     * chat.onMessage((data, client) => {
     *   // Full control - implement custom logic
     *   if (isValidMessage(data)) {
     *     chat.publish(data, { exclude: [client.id] })
     *   }
     * })
     * ```
     *
     * @internal
     */
    override async dispatch(
        data: T,
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        if (this.messageHandlers.size > 0) {
            // Intercept mode: developer handles everything manually
            for (const handler of this.messageHandlers) {
                try {
                    await handler(data, client, message)
                } catch (error) {
                    this.registry.logger?.error(
                        `[${this.name}] Error in message handler:`,
                        error as Error,
                    )
                }
            }
        } else {
            // Auto-relay mode: forward to all subscribers, excluding sender
            this.publish(data, { exclude: [client.id] })
        }
    }

    /**
     * Check if a client is subscribed to this channel
     *
     * @param subscriber - The subscriber (client) ID to check
     * @returns `true` if the client is subscribed, `false` otherwise
     *
     * @example
     * ```ts
     * if (chat.hasSubscriber('client-123')) {
     *   console.log('Client is subscribed to chat')
     * }
     * ```
     */
    hasSubscriber(subscriber: SubscriberId): boolean {
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    /**
     * Get all subscribers to this channel
     *
     * @remarks
     * Returns a copy of the subscribers set to prevent external modification.
     * The returned set is a snapshot and may not reflect future changes.
     *
     * @returns A Set of subscriber IDs
     *
     * @example
     * ```ts
     * const subscribers = chat.getSubscribers()
     * console.log(`Subscribers: ${Array.from(subscribers).join(', ')}`)
     *
     * // Check if a specific client is subscribed
     * if (subscribers.has('client-123')) {
     *   console.log('Client 123 is subscribed')
     * }
     * ```
     */
    getSubscribers(): Set<SubscriberId> {
        // Return a copy to prevent external modification
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Check if the channel has no subscribers
     *
     * @returns `true` if no clients are subscribed, `false` otherwise
     *
     * @example
     * ```ts
     * if (chat.isEmpty()) {
     *   console.log('No one is in the chat')
     * }
     * ```
     */
    isEmpty(): boolean {
        return this.registry.getChannelSubscribers(this.name).size === 0
    }
}
