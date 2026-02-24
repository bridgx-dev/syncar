/**
 * Message Handler
 * Processes data messages from clients and routes to channels.
 *
 * @module handlers/message-handler
 */

import type { IClientRegistry } from '../types/client.js'
import type { IMiddlewareManager } from '../types/middleware.js'
import type { IEventEmitter } from '../types/events.js'
import type { IServerEventMap } from '../types/events.js'
import type { IServerClient } from '../types/client.js'
import type { IChannel } from '../types/base.js'
import type { IChannelTransport } from '../types/channel.js'
import type { DataMessage, ChannelName } from '@synnel/types'
import { MessageError, ChannelError } from '../errors/index.js'
import { isDataMessage } from '@synnel/lib'

/**
 * Channel map type
 * Maps channel names to channel instances
 */
export type ChannelMap = Map<ChannelName, IChannel<unknown>>

// ============================================================
// MESSAGE HANDLER OPTIONS
// ============================================================

/**
 * Message handler options
 *
 * @example
 * ```ts
 * const options: MessageHandlerOptions = {
 *   emitMessageEvent: true,
 *   requireChannel: true
 * }
 * ```
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

// ============================================================
// MESSAGE HANDLER CLASS
// ============================================================

/**
 * Message Handler
 * Processes data messages from clients.
 *
 * This handler:
 * 1. Validates message format
 * 2. Executes message middleware
 * 3. Routes to appropriate channel
 * 4. Emits message event
 *
 * @example
 * ```ts
 * import { MessageHandler } from '@synnel/server/handlers'
 *
 * const messageHandler = new MessageHandler({
 *   registry: clientRegistry,
 *   middleware: middlewareManager,
 *   emitter: eventEmitter,
 *   channels: new Map()
 * })
 *
 * // Handle incoming message
 * await messageHandler.handleMessage(client, message)
 * ```
 */
export class MessageHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private readonly channels: ChannelMap
  private readonly options: Required<MessageHandlerOptions>

  /**
   * Create a new message handler
   *
   * @param dependencies - Handler dependencies
   *
   * @example
   * ```ts
   * const handler = new MessageHandler({
   *   registry: clientRegistry,
   *   middleware: middlewareManager,
   *   emitter: eventEmitter,
   *   channels: channelMap
   * })
   * ```
   */
  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    emitter: IEventEmitter<IServerEventMap>
    channels: ChannelMap
    options?: MessageHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware
    this.emitter = dependencies.emitter
    this.channels = dependencies.channels

    // Apply defaults
    this.options = {
      emitMessageEvent: dependencies.options?.emitMessageEvent ?? true,
      requireChannel: dependencies.options?.requireChannel ?? true,
      executeMiddleware: dependencies.options?.executeMiddleware ?? true,
    }
  }

  /**
   * Handle a message from a client
   *
   * Process flow:
   * 1. Validate message is a DataMessage
   * 2. Validate channel exists (if required)
   * 3. Execute message middleware
   * 4. Route to channel for processing
   * 5. Emit message event
   *
   * @param client - The client who sent the message
   * @param message - The message to process
   * @throws MessageError if message validation fails
   * @throws ChannelError if channel not found (when required)
   *
   * @example
   * ```ts
   * try {
   *   await messageHandler.handleMessage(client, dataMessage)
   * } catch (error) {
   *   if (error instanceof ChannelError) {
   *     console.log('Channel not found:', error.message)
   *   }
   * }
   * ```
   */
  async handleMessage<T = unknown>(
    client: IServerClient,
    message: DataMessage<T>,
  ): Promise<void> {
    // Validate message is a DataMessage
    if (!isDataMessage<T>(message)) {
      throw new MessageError('Invalid message type: expected DATA message')
    }

    // Validate channel exists
    if (this.options.requireChannel) {
      const channel = this.channels.get(message.channel)
      if (!channel) {
        throw new ChannelError(`Channel not found: ${message.channel}`)
      }
    }

    // Execute message middleware
    if (this.options.executeMiddleware) {
      await this.middleware.executeMessage(client, message)
    }

    // Route to channel for processing
    const channel = this.channels.get(message.channel)
    if (channel) {
      // Channel will handle the message via its handlers
      // The message is delivered to subscribers through the channel's publish mechanism
      // For server-side handling, channels have onMessage handlers registered
    }

    // Emit message event
    if (this.options.emitMessageEvent) {
      this.emitter.emit('message', client, message)
    }
  }

  /**
   * Check if a message can be processed
   *
   * Validates that:
   * - Message is a DataMessage
   * - Channel exists (if required)
   *
   * @param message - The message to validate
   * @returns true if message can be processed
   *
   * @example
   * ```ts
   * if (messageHandler.canProcessMessage(message)) {
   *   await messageHandler.handleMessage(client, message)
   * }
   * ```
   */
  canProcessMessage<T = unknown>(message: DataMessage<T>): boolean {
    // Must be a DataMessage
    if (!isDataMessage<T>(message)) {
      return false
    }

    // Channel must exist (if required)
    if (this.options.requireChannel) {
      return this.channels.has(message.channel)
    }

    return true
  }

  /**
   * Get the channel for a message
   *
   * @param message - The message
   * @returns The channel or undefined if not found
   *
   * @example
   * ```ts
   * const channel = messageHandler.getChannelForMessage(message)
   * if (channel) {
   *   console.log(`Channel: ${channel.name}`)
   * }
   * ```
   */
  getChannelForMessage<T = unknown>(message: DataMessage<T>): IChannelTransport<T> | undefined {
    const channel = this.channels.get(message.channel)
    return channel as IChannelTransport<T> | undefined
  }

  /**
   * Get handler options
   *
   * @returns Current handler options
   *
   * @example
   * ```ts
   * const options = messageHandler.getOptions()
   * console.log('Require channel:', options.requireChannel)
   * ```
   */
  getOptions(): Readonly<Required<MessageHandlerOptions>> {
    return this.options
  }
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IClientRegistry,
  IServerClient,
} from '../types/client.js'

export type { IMiddlewareManager } from '../types/middleware.js'
export type { IEventEmitter } from '../types/events.js'
export type { IServerEventMap } from '../types/events.js'
export type { IChannel, IMessageHandler, ILifecycleHandler } from '../types/base.js'
export type { DataMessage } from '@synnel/types'
