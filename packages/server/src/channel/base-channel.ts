import type {
    IChannel,
    ChannelName,
    ClientId,
    IPublishOptions,
    IClientRegistry,
} from '../types'
import { createDataMessage } from '../lib'

export abstract class BaseChannel<T = unknown, N extends ChannelName = ChannelName>
    implements IChannel<T> {
    constructor(
        public readonly name: N,
        protected readonly registry: IClientRegistry,
        protected readonly chunkSize: number = 500,
    ) { }

    abstract get subscriberCount(): number

    abstract isEmpty(): boolean

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
