import {
    type ChannelName,
    type ClientId,
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

import { createDataMessage } from './utils'
import { ClientRegistry } from './registry'

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
// RE-EXPORT UNIFIED CHANNEL CLASS
// ============================================================

/**
 * Unified Channel - supports both broadcast and multicast modes
 *
 * @remarks
 * This is a re-export of the new unified Channel class from channel-new.ts.
 * The Channel class replaces BroadcastChannel and MulticastChannel with a
 * single API that supports configurable scope and flow options.
 *
 * @example
 * ```ts
 * import { Channel } from '@syncar/server'
 *
 * const chat = new Channel({
 *   name: 'chat',
 *   registry: registry,
 *   options: { scope: 'subscribers', flow: 'bidirectional' }
 * })
 * ```
 */
export { Channel } from './channel-new'
