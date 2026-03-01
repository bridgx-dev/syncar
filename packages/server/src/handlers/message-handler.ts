/**
 * Message Handler
 * Processes data messages from clients and routes to channels.
 */

import type {
  IClientRegistry,
  IClientConnection,
  IChannel,
  IChannelTransport,
  DataMessage,
} from '../types'

import { MessageError, ChannelError } from '../errors'
import { isDataMessage } from '../lib'

/**
 * Message handler options
 */
export interface MessageHandlerOptions {

  /**
   * Whether to require a valid channel for data messages
   * @default true
   */
  requireChannel?: boolean
}



/**
 * Message Handler
 * Processes data messages from clients.
 */
export class MessageHandler {
  private readonly registry: IClientRegistry
  private readonly options: Required<MessageHandlerOptions>

  /**
   * Create a new message handler
   */
  constructor(dependencies: {
    registry: IClientRegistry
    options?: MessageHandlerOptions
  }) {
    this.registry = dependencies.registry

    // Apply defaults
    this.options = {
      requireChannel: dependencies.options?.requireChannel ?? true,
    }
  }


  /**
   * Handle a message from a client
   */
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

    // Route to channel for processing (triggers onMessage handlers)
    if (channel) {
      await (channel as IChannelTransport<T>).receive(
        message.data,
        client,
        message,
      )
    }

  }

  /**
   * Check if a message can be processed
   */
  canProcessMessage<T = unknown>(message: DataMessage<T>): boolean {
    if (!isDataMessage<T>(message)) {
      return false
    }

    if (this.options.requireChannel) {
      return !!this.registry.getChannel<T>(message.channel)
    }


    return true
  }

  /**
   * Get the channel for a message
   */
  getChannelForMessage<T = unknown>(
    message: DataMessage<T>,
  ): IChannel<T> | undefined {
    return this.registry.getChannel<T>(message.channel)
  }

  /**
   * Get handler options
   */
  getOptions(): Readonly<Required<MessageHandlerOptions>> {
    return this.options
  }
}
