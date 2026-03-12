import type { IClientConnection, DataMessage } from '../types'

import { MessageError, ChannelError } from '../errors'
import { isDataMessage } from '../utils'
import { ContextManager } from '../context'
import { ClientRegistry } from '../registry'

export class MessageHandler {
    private readonly registry: ClientRegistry
    private readonly context: ContextManager

    constructor(dependencies: {
        registry: ClientRegistry
        context: ContextManager
    }) {
        this.registry = dependencies.registry
        this.context = dependencies.context
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

        // Validate channel exists (always required by default)
        if (!channel) {
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
}
