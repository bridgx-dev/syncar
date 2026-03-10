import type { IClientConnection, DataMessage } from '../types'
import { Channel } from '../channel'

import { MessageError, ChannelError } from '../errors'
import { isDataMessage } from '../utils'
import { ContextManager } from '../context'
import { ClientRegistry } from '../registry'

export interface MessageHandlerOptions {
    requireChannel?: boolean
}

export class MessageHandler {
    private readonly registry: ClientRegistry
    private readonly context: ContextManager
    private readonly options: Required<MessageHandlerOptions>

    constructor(dependencies: {
        registry: ClientRegistry
        context: ContextManager
        options?: MessageHandlerOptions
    }) {
        this.registry = dependencies.registry
        this.context = dependencies.context

        // Apply defaults
        this.options = {
            requireChannel: dependencies.options?.requireChannel ?? true,
        }
    }

    async handleMessage<T = unknown>(
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        // Validate message is a DataMessage
        if (!isDataMessage<T>(message)) {
            throw new MessageError(
                'Invalid message type: expected DATA message',
            )
        }

        // Get channel using the registry
        const channel = this.registry.getChannel<T>(message.channel)

        // Validate channel exists
        if (this.options.requireChannel && !channel) {
            throw new ChannelError(`Channel not found: ${message.channel}`)
        }

        // Build the middleware pipeline
        const pipeline = this.context.getPipeline(channel)

        // Create Context
        const ctx = this.context.createMessageContext(client, message)

        // Define Kernel
        const kernel = async () => {
            if (channel) {
                await channel.dispatch(message.data, client, message)
            }
        }

        // Execute Onion
        await this.context.execute(ctx, pipeline, kernel)
    }

    canProcessMessage<T = unknown>(message: DataMessage<T>): boolean {
        if (!isDataMessage<T>(message)) {
            return false
        }

        if (this.options.requireChannel) {
            return !!this.registry.getChannel<T>(message.channel)
        }

        return true
    }

    getChannelForMessage<T = unknown>(
        message: DataMessage<T>,
    ): Channel<T> | undefined {
        return this.registry.getChannel<T>(message.channel)
    }

    getOptions(): Readonly<Required<MessageHandlerOptions>> {
        return this.options
    }
}
