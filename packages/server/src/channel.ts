import {
    type ChannelName,
    type ClientId,
    type SubscriberId,
    type DataMessage,
    type IClientConnection,
    type IMiddleware,
    type ChannelOptions,
    type ChannelScope,
    type ChannelFlow,
} from './types'
import { createDataMessage, assertValidChannelName } from './utils'
import { ClientRegistry } from './registry'

// ============================================================
// TYPES
// ============================================================

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

// ============================================================
// BASE CHANNEL
// ============================================================

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
 * @see {@link Channel} for the unified channel implementation
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

// ============================================================
// UNIFIED CHANNEL
// ============================================================

/**
 * Unified Channel - supports both broadcast and multicast modes
 *
 * @remarks
 * A single channel class that replaces `BroadcastChannel` and `MulticastChannel`.
 * Behavior is controlled by `scope` and `flow` options:
 *
 * - **scope: 'broadcast'**: Sends to ALL clients, no subscription concept
 * - **scope: 'subscribers'**: Sends only to subscribed clients
 *
 * - **flow: 'bidirectional'**: Server and clients can send
 * - **flow: 'send-only'**: Only server can send
 * - **flow: 'receive-only'**: Only clients can send
 *
 * @template T - Type of data published on this channel (default: unknown)
 *
 * @example
 * ### Default: subscribers + bidirectional (chat room)
 * ```ts
 * const chat = server.createChannel('chat')
 * chat.onMessage((data, client) => {
 *   console.log(`${client.id}: ${data.text}`)
 *   chat.publish(data, { exclude: [client.id] })
 * })
 * ```
 *
 * @example
 * ### Broadcast: all clients, send-only (announcements)
 * ```ts
 * const alerts = server.createChannel('alerts', { scope: 'broadcast' })
 * alerts.publish({ type: 'warning', message: 'Server maintenance' })
 * // alerts.subscribe() - ❌ Method not available for broadcast
 * ```
 *
 * @example
 * ### Subscribers + send-only (live dashboard)
 * ```ts
 * const updates = server.createChannel('updates', { flow: 'send-only' })
 * updates.publish({ cpu: 45, memory: 67 })
 * // updates.onMessage() - ❌ Error in send-only mode
 * ```
 */
export class Channel<T = unknown> extends BaseChannel<T> {
    private readonly middlewares: IMiddleware[] = []
    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()

    /** The channel scope: 'broadcast' or 'subscribers' */
    public readonly scope: ChannelScope

    /** The channel flow: 'bidirectional', 'send-only', or 'receive-only' */
    public readonly flow: ChannelFlow

    /**
     * Creates a new Channel instance
     *
     * @param config.name - The channel name
     * @param config.registry - The client registry
     * @param config.options - Channel options (scope, flow)
     * @param config.chunkSize - Broadcast chunk size
     *
     * @throws {Error} If scope is 'broadcast' and flow is not 'send-only'
     *
     * @example
     * ```ts
     * new Channel({
     *   name: 'chat',
     *   registry: registry,
     *   options: { scope: 'subscribers', flow: 'bidirectional' }
     * })
     * ```
     */
    constructor(config: {
        name: ChannelName
        registry: ClientRegistry
        options?: ChannelOptions
        chunkSize?: number
    }) {
        const { name, registry, options, chunkSize } = config

        // Apply defaults
        // Broadcast scope automatically sets flow to send-only
        const scope = options?.scope ?? 'subscribers'
        const flow = options?.flow ?? (scope === 'broadcast' ? 'send-only' : 'bidirectional')

        // Validation: broadcast scope only allows send-only flow
        if (scope === 'broadcast' && flow !== 'send-only') {
            throw new Error(
                `Invalid channel configuration: broadcast scope only supports send-only flow. ` +
                `Got scope '${scope}' and flow '${flow}'.`
            )
        }

        // For broadcast scope, use the broadcast channel name
        const channelName = scope === 'broadcast' ? '__broadcast__' : name

        // Validate channel name
        assertValidChannelName(channelName)

        super(channelName, registry, chunkSize)

        this.scope = scope
        this.flow = flow
    }

    /**
     * Get target clients based on scope
     *
     * @internal
     */
    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        if (this.scope === 'broadcast') {
            return Array.from(this.registry.connections.keys())
        }
        return Array.from(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Get the number of subscribers/clients
     *
     * @returns Number of clients that will receive messages
     *
     * @example
     * ```ts
     * console.log(`Channel reach: ${channel.subscriberCount}`)
     * ```
     */
    get subscriberCount(): number {
        if (this.scope === 'broadcast') {
            return this.registry.connections.size
        }
        return this.registry.getChannelSubscribers(this.name).size
    }

    /**
     * Check if channel has no subscribers/clients
     *
     * @returns `true` if no clients will receive messages
     *
     * @example
     * ```ts
     * if (channel.isEmpty()) {
     *   console.log('No one is listening')
     * }
     * ```
     */
    isEmpty(): boolean {
        return this.subscriberCount === 0
    }

    /**
     * Get middleware for this channel
     *
     * @internal
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Register channel-specific middleware
     *
     * @param middleware - The middleware function
     *
     * @example
     * ```ts
     * channel.use(async (context, next) => {
     *   console.log(`Action: ${context.req.action}`)
     *   await next()
     * })
     * ```
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Register a message handler (not available in send-only mode)
     *
     * @param handler - The message handler function
     * @returns Unsubscribe function
     * @throws {Error} If flow is 'send-only'
     *
     * @example
     * ```ts
     * const unsubscribe = channel.onMessage((data, client) => {
     *   console.log(`Received from ${client.id}:`, data)
     * })
     *
     * // Later
     * unsubscribe()
     * ```
     */
    onMessage(handler: IMessageHandler<T>): () => void {
        if (this.flow === 'send-only') {
            throw new Error(
                `Cannot register message handler on channel '${this.name}': ` +
                `onMessage is not available in send-only mode.`
            )
        }
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    /**
     * Subscribe a client (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if subscribed successfully
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * channel.subscribe('client-123')
     * ```
     */
    subscribe(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot subscribe to channel '${this.name}': ` +
                `subscribe is not available for broadcast channels. ` +
                `Broadcast channels send to all clients automatically.`
            )
        }
        return this.registry.subscribe(subscriber, this.name)
    }

    /**
     * Unsubscribe a client (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if unsubscribed successfully
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * channel.unsubscribe('client-123')
     * ```
     */
    unsubscribe(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot unsubscribe from channel '${this.name}': ` +
                `unsubscribe is not available for broadcast channels.`
            )
        }
        return this.registry.unsubscribe(subscriber, this.name)
    }

    /**
     * Check if a client is subscribed (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if subscribed
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * if (channel.hasSubscriber('client-123')) {
     *   console.log('Client is subscribed')
     * }
     * ```
     */
    hasSubscriber(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot check subscribers on channel '${this.name}': ` +
                `hasSubscriber is not available for broadcast channels.`
            )
        }
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    /**
     * Get all subscribers (only available for subscriber scope)
     *
     * @returns Set of subscriber IDs
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * const subs = channel.getSubscribers()
     * console.log(`Subscribers: ${Array.from(subs).join(', ')}`)
     * ```
     */
    getSubscribers(): Set<SubscriberId> {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot get subscribers on channel '${this.name}': ` +
                `getSubscribers is not available for broadcast channels.`
            )
        }
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Dispatch an incoming client message
     *
     * @internal
     */
    override async dispatch(
        data: T,
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        // Send-only channels don't receive client messages
        if (this.flow === 'send-only') {
            return
        }

        if (this.messageHandlers.size > 0) {
            // Intercept mode: handlers process the message
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
            // Auto-relay mode: forward to all subscribers except sender
            // Only for subscriber scope with bidirectional flow
            if (this.scope === 'subscribers') {
                this.publish(data, { exclude: [client.id] })
            }
        }
    }
}
