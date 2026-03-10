import {
    type ChannelName,
    type ClientId,
    type DataMessage,
    type IClientConnection,
    type IMiddleware,
    type ChannelOptions,
    type ChannelScope,
    type ChannelFlow,
} from './types'
import { ClientRegistry } from './registry'
import { createDataMessage } from './utils'

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
 * Base message handler signature
 *
 * @remarks
 * Type-safe handler function for processing incoming messages on a channel.
 * Handlers receive the message data, sending client, and the original message object.
 *
 * @template T - Type of data expected in messages
 */
export type IMessageHandler<T> = (
    /** The message data payload */
    data: T,
    /** The client connection that sent the message */
    client: IClientConnection,
    /** The complete message object with metadata */
    message: DataMessage<T>,
) => void | Promise<void>

/**
 * Unified Channel implementation
 *
 * @remarks
 * Handles the complexities of chunked publishing, message routing, and
 * connection management. Provides automatic chunking for large broadcasts
 * to avoid event loop blocking.
 *
 * @template T - Type of data published on this channel (default: unknown)
 *
 * @example
 * ### Default: subscribers + bidirectional (chat room)
 * ```ts
 * const chat = server.createChannel('chat')
 * chat.onMessage((data, client) => {
 *   console.log(`${client.id}: ${data.text}`)
 *   chat.publish(data)
 * })
 * ```
 */
export class Channel<T = unknown> {
    private readonly middlewares: IMiddleware[] = []
    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()
    private _lastMessageAt?: number
    private _createdAt: number

    /** The channel name */
    public readonly name: ChannelName

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
     * @param config.chunkSize - Broadcast chunk size (default: 500)
     *
     * @throws {Error} If scope is 'broadcast' and flow is not 'send-only'
     */
    constructor(config: {
        name: ChannelName
        registry: ClientRegistry
        options?: ChannelOptions
        chunkSize?: number
    }) {
        const { name, registry, options, chunkSize = 500 } = config

        // Apply defaults
        const scope = options?.scope ?? 'subscribers'
        const flow =
            options?.flow ??
            (scope === 'broadcast' ? 'send-only' : 'bidirectional')

        // Validation: broadcast scope only allows send-only flow
        if (scope === 'broadcast' && flow !== 'send-only') {
            throw new Error(
                `Invalid channel configuration: broadcast scope only supports send-only flow. ` +
                `Got scope '${scope}' and flow '${flow}'.`,
            )
        }

        this.name = name
        this.registry = registry
        this.chunkSize = chunkSize
        this.scope = scope
        this.flow = flow
        this._createdAt = Date.now()
    }

    /**
     * Get the current subscriber count
     */
    get subscriberCount(): number {
        if (this.scope === 'broadcast') {
            return this.registry.connections.size
        }
        return this.registry.getChannelSubscribers(this.name).size
    }

    /**
     * Check if the channel has no subscribers
     */
    isEmpty(): boolean {
        return this.subscriberCount === 0
    }

    /**
     * Get the current state of the channel
     */
    getState(): IChannelState {
        return {
            name: this.name,
            subscriberCount: this.subscriberCount,
            createdAt: this._createdAt,
            lastMessageAt: this._lastMessageAt,
        }
    }

    /**
     * Get the middleware for this channel
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Register channel-specific middleware
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Publish data to the channel
     *
     * @remarks
     * Sends the data to all target clients. If the number of clients exceeds
     * `chunkSize`, messages are sent in chunks using `setImmediate` to avoid
     * blocking the event loop.
     *
     * @param data - The data to publish
     */
    publish(data: T): void {
        this._lastMessageAt = Date.now()
        const clients = this.getTargetClients()

        if (clients.length > this.chunkSize) {
            this.publishInChunks(data, clients)
        } else {
            this.publishToClients(data, clients)
        }
    }

    /**
     * Register a message handler (not available in send-only mode)
     *
     * @param handler - The message handler function
     * @returns Unsubscribe function
     */
    onMessage(handler: IMessageHandler<T>): () => void {
        if (this.flow === 'send-only') {
            throw new Error(
                `Cannot register message handler on channel '${this.name}': ` +
                `onMessage is not available in send-only mode.`,
            )
        }
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    /**
     * Subscribe a client (only available for subscriber scope)
     */
    subscribe(subscriber: ClientId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot subscribe to channel '${this.name}': ` +
                `subscribe is not available for broadcast channels.`,
            )
        }
        return this.registry.subscribe(subscriber, this.name)
    }

    /**
     * Unsubscribe a client (only available for subscriber scope)
     */
    unsubscribe(subscriber: ClientId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot unsubscribe from channel '${this.name}': ` +
                `unsubscribe is not available for broadcast channels.`,
            )
        }
        return this.registry.unsubscribe(subscriber, this.name)
    }

    /**
     * Check if a client is subscribed (only available for subscriber scope)
     */
    hasSubscriber(subscriber: ClientId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot check subscribers on channel '${this.name}': ` +
                `hasSubscriber is not available for broadcast channels.`,
            )
        }
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    /**
     * Get all subscribers (only available for subscriber scope)
     */
    getSubscribers(): Set<ClientId> {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot get subscribers on channel '${this.name}': ` +
                `getSubscribers is not available for broadcast channels.`,
            )
        }
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Dispatch an incoming client message
     *
     * @internal
     */
    async dispatch(
        data: T,
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        if (this.flow === 'send-only') {
            return
        }

        if (this.messageHandlers.size > 0) {
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
        } else if (this.scope === 'subscribers' && this.flow === 'bidirectional') {
            // Auto-relay mode: forward to all subscribers except sender
            const clients = Array.from(this.registry.getChannelSubscribers(this.name))
                .filter(id => id !== client.id)
            this.publishToClients(data, clients)
        }
    }

    /**
     * Get target clients based on scope
     */
    protected getTargetClients(): ClientId[] {
        if (this.scope === 'broadcast') {
            return Array.from(this.registry.connections.keys())
        }
        return Array.from(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Send message to a small group of clients
     */
    protected publishToClients(data: T, clientIds: ClientId[]): void {
        const message = createDataMessage<T>(this.name, data)

        for (const clientId of clientIds) {
            const client = this.registry.connections.get(clientId)
            if (client) {
                try {
                    client.socket.send(JSON.stringify(message))
                } catch (error) {
                    this.registry.logger?.error(
                        `[${this.name}] Failed to send to ${clientId}:`,
                        error as Error,
                    )
                }
            }
        }
    }

    /**
     * Send message in chunks for large subscriber lists
     */
    protected publishInChunks(data: T, clientIds: ClientId[]): void {
        let index = 0

        const nextChunk = () => {
            const chunk = clientIds.slice(index, index + this.chunkSize)
            if (chunk.length === 0) return

            this.publishToClients(data, chunk)
            index += this.chunkSize

            if (index < clientIds.length) {
                setImmediate(nextChunk)
            }
        }
        nextChunk()
    }

    /**
     * Client registry and chunking config
     */
    protected readonly registry: ClientRegistry
    protected readonly chunkSize: number
}
