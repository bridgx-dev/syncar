/**
 * Base Channel
 * Abstract base class for all channel types providing common publishing logic.
 */

import type {
    IChannel,
    ChannelName,
    ClientId,
    IPublishOptions,
    IClientRegistry,
} from '../types'
import { createDataMessage } from '../lib'

/**
 * Base Channel implementation
 * Handles the complexities of chunked publishing and filtering.
 */
export abstract class BaseChannel<T = unknown, N extends ChannelName = ChannelName>
    implements IChannel<T> {
    constructor(
        public readonly name: N,
        protected readonly registry: IClientRegistry,
        protected readonly chunkSize: number = 500,
    ) { }

    /**
     * Get the number of subscribers
     */
    abstract get subscriberCount(): number

    /**
     * Check if channel is empty
     */
    abstract isEmpty(): boolean

    /**
     * Publish data to subscribers
     *
     * @param data - The data to publish
     * @param options - Optional publish options (to, exclude)
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
     * Get the list of client IDs that should receive the message
     *
     * @param options - Optional publish options
     * @returns Array of client IDs
     */
    protected abstract getTargetClients(options?: IPublishOptions): ClientId[]

    /**
     * Internal helper to publish to a set of clients synchronously
     */
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

    /**
     * Publish data to clients in chunks using setImmediate
     */
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
