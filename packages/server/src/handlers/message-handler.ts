import type {
  IClientRegistry,
  IClientConnection,
  IChannel,
  IChannelTransport,
  DataMessage,
  IMiddleware,
  IMiddlewareManager,
} from '../types'

import { MessageError, ChannelError } from '../errors'
import { isDataMessage } from '../lib'

export interface MessageHandlerOptions {
  requireChannel?: boolean
}

export class MessageHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly options: Required<MessageHandlerOptions>

  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    options?: MessageHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware

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
      throw new MessageError('Invalid message type: expected DATA message')
    }

    // Get channel using the registry
    const channel = this.registry.getChannel<T>(message.channel)

    // Validate channel exists
    if (this.options.requireChannel && !channel) {
      throw new ChannelError(`Channel not found: ${message.channel}`)
    }

    // Build the middleware pipeline
    const globalMiddlewares = this.middleware.getMiddlewares()
    let pipeline = [...globalMiddlewares]

    if (channel && 'getMiddlewares' in channel) {
      // Append channel-specific middleware securely
      const channelMiddlewares = (channel as unknown as { getMiddlewares?: () => IMiddleware[] }).getMiddlewares?.()
      if (channelMiddlewares) {
        pipeline = [...pipeline, ...channelMiddlewares]
      }
    }

    // Create Context
    const ctx = this.middleware.createMessageContext(client, message)

    // Define Kernel
    const kernel = async () => {
      // Route to channel for processing (triggers onMessage handlers)
      if (channel) {
        await (channel as IChannelTransport<T>).receive(
          message.data,
          client,
          message,
        )
      }
    }

    // Execute Onion
    await this.middleware.execute(ctx, pipeline, kernel)
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
  ): IChannel<T> | undefined {
    return this.registry.getChannel<T>(message.channel)
  }

  getOptions(): Readonly<Required<MessageHandlerOptions>> {
    return this.options
  }
}
