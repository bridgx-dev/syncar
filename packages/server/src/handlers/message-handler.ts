/**
 * Message Handler
 * Processes data messages from clients and routes to channels.
 */

import type {
  IClientRegistry,
  IMiddlewareManager,
  IEventEmitter,
  IServerEventMap,
  IClientConnection,
  IChannelTransport,
  DataMessage,
} from '../types'
import { MessageError, ChannelError } from '../errors'
import { isDataMessage } from '@synnel/lib'

/**
 * Message handler options
 */
export interface MessageHandlerOptions {
  /**
   * Whether to emit message events
   * @default true
   */
  emitMessageEvent?: boolean

  /**
   * Whether to require a valid channel for data messages
   * @default true
   */
  requireChannel?: boolean

  /**
   * Whether to execute message middleware
   * @default true
   */
  executeMiddleware?: boolean
}

/**
 * Message Handler
 * Processes data messages from clients.
 */
export class MessageHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private readonly options: Required<MessageHandlerOptions>

  /**
   * Create a new message handler
   */
  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    emitter: IEventEmitter<IServerEventMap>
    options?: MessageHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware
    this.emitter = dependencies.emitter

    // Apply defaults
    this.options = {
      emitMessageEvent: dependencies.options?.emitMessageEvent ?? true,
      requireChannel: dependencies.options?.requireChannel ?? true,
      executeMiddleware: dependencies.options?.executeMiddleware ?? true,
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

    const channel = this.registry.getChannel<T>(message.channel)

    // Validate channel exists
    if (this.options.requireChannel && !channel) {
      throw new ChannelError(`Channel not found: ${message.channel}`)
    }

    // Execute message middleware
    if (this.options.executeMiddleware) {
      await this.middleware.executeMessage(client, message)
    }

    // Route to channel for processing (if it exists)
    if (channel) {
      await channel.receive(message.data, client, message)
    }

    // Emit message event
    if (this.options.emitMessageEvent) {
      this.emitter.emit('message', client, message)
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
      return !!this.registry.getChannel(message.channel)
    }

    return true
  }

  /**
   * Get the channel for a message
   */
  getChannelForMessage<T = unknown>(
    message: DataMessage<T>,
  ): IChannelTransport<T> | undefined {
    return this.registry.getChannel<T>(message.channel)
  }

  /**
   * Get handler options
   */
  getOptions(): Readonly<Required<MessageHandlerOptions>> {
    return this.options
  }
}
