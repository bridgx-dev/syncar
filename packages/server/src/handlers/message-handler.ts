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
  IChannel,
  IChannelTransport,
  DataMessage,
  ChannelName,
} from '../types'
import { MessageError, ChannelError } from '../errors'
import { isDataMessage } from '../lib'

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

  /**
   * Optional function to get a channel by name
   * If provided, this will be used instead of registry.getChannel()
   */
  getChannel?<T = unknown>(name: ChannelName): IChannel<T> | undefined
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
      getChannel: dependencies.options?.getChannel ?? ((name: ChannelName) => this.registry.getChannel(name)),
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

    // Get channel using the getChannel callback (or fallback to registry)
    const channel = this.options.getChannel<T>(message.channel)

    // Validate channel exists
    if (this.options.requireChannel && !channel) {
      throw new ChannelError(`Channel not found: ${message.channel}`)
    }

    // Execute message middleware
    if (this.options.executeMiddleware) {
      await this.middleware.executeMessage(client, message)
    }

    // Route to channel for processing (triggers onMessage handlers)
    if (channel) {
      await (channel as IChannelTransport<T>).receive(
        message.data,
        client,
        message,
      )
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
      return !!this.options.getChannel<T>(message.channel)
    }

    return true
  }

  /**
   * Get the channel for a message
   */
  getChannelForMessage<T = unknown>(
    message: DataMessage<T>,
  ): IChannel<T> | undefined {
    return this.options.getChannel<T>(message.channel)
  }

  /**
   * Get handler options
   */
  getOptions(): Readonly<Required<MessageHandlerOptions>> {
    return this.options
  }
}
