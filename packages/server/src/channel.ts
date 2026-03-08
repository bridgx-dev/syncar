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
 */
export interface IChannelState {
    name: string
    subscriberCount: number
    createdAt: number
    lastMessageAt?: number
}

/**
 * Publish options for channel messages
 */
export interface IPublishOptions {
    to?: readonly ClientId[]
    exclude?: readonly ClientId[]
}

/**
 * Base message handler signature
 */
export type IMessageHandler<T> = (
    data: T,
    client: IClientConnection,
    message: DataMessage<T>,
) => void | Promise<void>

/**
 * Base lifecycle handler signature
 */
export type ILifecycleHandler = (
    client: IClientConnection,
) => void | Promise<void>
import { createDataMessage } from './lib'
import { ClientRegistry } from './registry'
import { BROADCAST_CHANNEL } from './config'

/**
 * Base Channel implementation
 * Handles the complexities of chunked publishing and filtering.
 */
export abstract class BaseChannel<
    T = unknown,
    N extends ChannelName = ChannelName,
> {
    constructor(
        public readonly name: N,
        protected readonly registry: ClientRegistry,
        protected readonly chunkSize: number = 500,
    ) { }

    abstract get subscriberCount(): number

    abstract isEmpty(): boolean

    abstract getMiddlewares(): IMiddleware[]

    handleSubscribe?(client: IClientConnection): Promise<void>
    handleUnsubscribe?(client: IClientConnection): Promise<void>

    publish(data: T, options?: IPublishOptions): void {
        const clients = this.getTargetClients(options)
        if (clients.length > this.chunkSize) {
            this.publishInChunks(data, clients, options)
        } else {
            this.publishToClients(data, clients, options)
        }
    }

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
                    console.error(`[${this.name}] Failed to send to ${clientId}:`, error)
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
 */
export class BroadcastChannel<T = unknown>
    extends BaseChannel<T, typeof BROADCAST_CHANNEL> {
    constructor(registry: ClientRegistry, chunkSize: number = 500) {
        super(BROADCAST_CHANNEL, registry, chunkSize)
    }

    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        return Array.from(this.registry.connections.keys())
    }

    get subscriberCount(): number {
        return this.registry.connections.size
    }

    isEmpty(): boolean {
        return this.registry.connections.size === 0
    }

    getMiddlewares(): IMiddleware[] {
        return []
    }
}

export interface MulticastChannelOptions {
    chunkSize?: number
}

/**
 * MulticastChannel - Lightweight channel reference
 */
export class MulticastChannel<T = unknown>
    extends BaseChannel<T> {
    private readonly middlewares: IMiddleware[] = []

    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()
    private readonly subscribeHandlers: Set<ILifecycleHandler> = new Set()
    private readonly unsubscribeHandlers: Set<ILifecycleHandler> = new Set()

    constructor(config: {
        name: ChannelName
        registry: ClientRegistry
        options?: MulticastChannelOptions
    }) {
        super(config.name, config.registry, config.options?.chunkSize)
    }

    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        return Array.from(this.registry.getChannelSubscribers(this.name))
    }

    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    get subscriberCount(): number {
        return this.registry.getChannelSubscribers(this.name).size
    }

    onMessage(handler: IMessageHandler<T>): () => void {
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    subscribe(subscriber: SubscriberId): boolean {
        return this.registry.subscribe(subscriber, this.name)
    }

    unsubscribe(subscriber: SubscriberId): boolean {
        return this.registry.unsubscribe(subscriber, this.name)
    }

    async receive(
        data: T,
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        for (const handler of this.messageHandlers) {
            try {
                await handler(data, client, message)
            } catch (error) {
                console.error(
                    `Error in message handler for channel ${this.name}:`,
                    error,
                )
            }
        }
    }

    onSubscribe(handler: ILifecycleHandler): () => void {
        this.subscribeHandlers.add(handler)
        return () => this.subscribeHandlers.delete(handler)
    }

    onUnsubscribe(handler: ILifecycleHandler): () => void {
        this.unsubscribeHandlers.add(handler)
        return () => this.unsubscribeHandlers.delete(handler)
    }

    override async handleSubscribe(client: IClientConnection): Promise<void> {
        for (const handler of this.subscribeHandlers) {
            try {
                await handler(client)
            } catch (error) {
                console.error(
                    `Error in subscribe handler for channel ${this.name}:`,
                    error,
                )
                // Re-throw to allow blocking subscription on handler error
                throw error
            }
        }
    }

    override async handleUnsubscribe(client: IClientConnection): Promise<void> {
        for (const handler of this.unsubscribeHandlers) {
            try {
                await handler(client)
            } catch (error) {
                console.error(
                    `Error in unsubscribe handler for channel ${this.name}:`,
                    error,
                )
            }
        }
    }

    hasSubscriber(subscriber: SubscriberId): boolean {
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    getSubscribers(): Set<SubscriberId> {
        // Return a copy to prevent external modification
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    isEmpty(): boolean {
        return this.registry.getChannelSubscribers(this.name).size === 0
    }
}
