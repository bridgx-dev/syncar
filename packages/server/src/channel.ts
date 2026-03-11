import {
    type ChannelName,
    type ClientId,
    type DataMessage,
    type IClientConnection,
    type IMiddleware,
} from './types'
import { ClientRegistry } from './registry'
import { publishMessage } from './utils'

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

export type ChannelFlow = 'bidirectional' | 'send-only' | 'receive-only'

/**
 * Channel creation options
 *
 * @example
 * ```ts
 * const options: ChannelOptions = { flow: 'receive-only' }
 * ```
 */
export interface ChannelOptions {
    /** Message direction: 'bidirectional', 'send-only', or 'receive-only' */
    flow?: ChannelFlow
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
 * @example
 * ```ts
 * const chat = server.createChannel('chat')
 * chat.onMessage((data, client) => {
 *   chat.publish(data, [client.id])
 * })
 * ```
 */
export class Channel<T = unknown> {
    /** The channel name */
    public readonly name: ChannelName

    /** The channel flow: 'bidirectional', 'send-only', or 'receive-only' */
    public readonly flow: ChannelFlow

    /** @internal */
    protected readonly registry: ClientRegistry
    /** @internal */
    protected readonly chunkSize: number

    private readonly middlewares: IMiddleware[] = []
    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()
    private _lastMessageAt?: number
    private _createdAt: number

    /** @internal */
    constructor(config: {
        name: ChannelName
        registry: ClientRegistry
        options?: ChannelOptions
        chunkSize?: number
    }) {
        const { name, registry, options, chunkSize = 500 } = config

        this.name = name
        this.registry = registry
        this.chunkSize = chunkSize
        this.flow = options?.flow ?? 'bidirectional'
        this._createdAt = Date.now()
    }

    /**
     * Subscribe a client to this channel
     * @param subscriber - Client ID to subscribe
     * @returns `true` if subscribed successfully
     */
    subscribe(subscriber: ClientId): boolean {
        return this.registry.subscribe(subscriber, this.name)
    }

    /**
     * Unsubscribe a client from this channel
     * @param subscriber - Client ID to unsubscribe
     * @returns `true` if unsubscribed successfully
     */
    unsubscribe(subscriber: ClientId): boolean {
        return this.registry.unsubscribe(subscriber, this.name)
    }

    /**
     * Check if a client is subscribed to this channel
     * @param subscriber - The client ID to check
     */
    hasSubscriber(subscriber: ClientId): boolean {
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    /**
     * Get all subscriber IDs for this channel
     */
    getSubscribers(): Set<ClientId> {
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Get the current count of subscribers
     */
    get subscriberCount(): number {
        return this.registry.getChannelSubscribers(this.name).size
    }

    /**
     * Check if the channel has no subscribers
     */
    isEmpty(): boolean {
        return this.subscriberCount === 0
    }

    /**
     * Publish data to all subscribers
     * @param data - The data to publish
     * @param exclude - Optional array of client IDs to exclude
     */
    publish(data: T, exclude: ClientId[] = []): void {
        this._lastMessageAt = Date.now()
        let connections = this.registry.getSubscribers(this.name)

        if (exclude.length > 0) {
            const excludeSet = new Set(exclude)
            connections = connections.filter((conn) => !excludeSet.has(conn.id))
        }

        if (connections.length === 0) return

        publishMessage<T>({
            channel: this.name,
            data,
            connections,
            chunkSize: this.chunkSize,
        })
    }

    /**
     * Register a message handler for incoming client data
     *
     * @returns Function to remove the handler
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
        } else if (this.flow === 'bidirectional') {
            // Auto-relay: forward to other subscribers
            this.publish(data, [client.id])
        }
    }

    /**
     * Register channel-specific middleware
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Get registered middleware for this channel
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Get runtime channel statistics
     */
    getState(): IChannelState {
        return {
            name: this.name,
            subscriberCount: this.subscriberCount,
            createdAt: this._createdAt,
            lastMessageAt: this._lastMessageAt,
        }
    }
}
