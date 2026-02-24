/**
 * Signal Handler
 * Processes signal messages (SUBSCRIBE, UNSUBSCRIBE, PING, PONG).
 *
 * @module handlers/signal-handler
 */

import type { IClientRegistry } from '../types/client.js'
import type { IMiddlewareManager } from '../types/middleware.js'
import type { IEventEmitter } from '../types/events.js'
import type { IServerEventMap } from '../types/events.js'
import type { IServerClient } from '../types/client.js'
import type { IChannelTransport } from '../types/channel.js'
import type { IMessageHandler, ILifecycleHandler } from '../types/base.js'
import type { IServerTransport } from '../types/transport.js'
import type {
  SignalMessage,
  SignalType,
  ChannelName,
  Message,
} from '@synnel/types'
import {
  createSignalMessage,
  createDataMessage,
} from '@synnel/lib'
import { ChannelError, MessageError } from '../errors/index.js'
import {
  BROADCAST_CHANNEL,
  ERROR_CODES,
} from '../config/constants.js'
import { isReservedChannelName } from '@synnel/lib'

// ============================================================
// TYPES
// ============================================================

/**
 * Extract sendToClient method type from transport interface
 * Ensures callback signature matches transport exactly
 */
type SendToClientFn = IServerTransport['sendToClient']

// ============================================================
// SIGNAL HANDLER OPTIONS
// ============================================================

/**
 * Signal handler options
 *
 * @example
 * ```ts
 * const options: SignalHandlerOptions = {
 *   emitSubscribeEvent: true,
 *   emitUnsubscribeEvent: true,
 *   allowReservedChannels: false
 * }
 * ```
 */
export interface SignalHandlerOptions {
  /**
   * Whether to emit subscribe events
   * @default true
   */
  emitSubscribeEvent?: boolean

  /**
   * Whether to emit unsubscribe events
   * @default true
   */
  emitUnsubscribeEvent?: boolean

  /**
   * Whether to allow clients to subscribe to reserved channels (starting with '__')
   * @default false
   */
  allowReservedChannels?: boolean

  /**
   * Whether to send SUBSCRIBED/UNSUBSCRIBED acknowledgment messages
   * @default true
   */
  sendAcknowledgments?: boolean

  /**
   * Whether to automatically respond to PING with PONG
   * @default true
   */
  autoRespondToPing?: boolean
}

// ============================================================
// SIGNAL HANDLER CLASS
// ============================================================

/**
 * Signal Handler
 * Processes signal messages from clients.
 *
 * This handler:
 * 1. Validates signal type
 * 2. Executes appropriate middleware
 * 3. Manages channel subscriptions
 * 4. Sends acknowledgment messages
 * 5. Emits subscribe/unsubscribe events
 *
 * @example
 * ```ts
 * import { SignalHandler } from '@synnel/server/handlers'
 *
 * const signalHandler = new SignalHandler({
 *   registry: clientRegistry,
 *   middleware: middlewareManager,
 *   emitter: eventEmitter,
 *   channels: new Map(),
 *   sendToClient: async (clientId, message) => { ... }
 * })
 *
 * // Handle signal message
 * await signalHandler.handleSignal(client, signalMessage)
 * ```
 */
export class SignalHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private readonly channels: Map<ChannelName, IChannelTransport<unknown>>
  private readonly sendToClient: SendToClientFn
  private readonly options: Required<SignalHandlerOptions>

  /**
   * Create a new signal handler
   *
   * @param dependencies - Handler dependencies
   *
   * @example
   * ```ts
   * const handler = new SignalHandler({
   *   registry: clientRegistry,
   *   middleware: middlewareManager,
   *   emitter: eventEmitter,
   *   channels: channelMap,
   *   sendToClient: transport.sendToClient
   * })
   * ```
   */
  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    emitter: IEventEmitter<IServerEventMap>
    channels: Map<ChannelName, IChannelTransport<unknown>>
    sendToClient: SendToClientFn
    options?: SignalHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware
    this.emitter = dependencies.emitter
    this.channels = dependencies.channels
    this.sendToClient = dependencies.sendToClient

    // Apply defaults
    this.options = {
      emitSubscribeEvent: dependencies.options?.emitSubscribeEvent ?? true,
      emitUnsubscribeEvent: dependencies.options?.emitUnsubscribeEvent ?? true,
      allowReservedChannels: dependencies.options?.allowReservedChannels ?? false,
      sendAcknowledgments: dependencies.options?.sendAcknowledgments ?? true,
      autoRespondToPing: dependencies.options?.autoRespondToPing ?? true,
    }
  }

  /**
   * Handle a signal message from a client
   *
   * Routes to the appropriate handler based on signal type:
   * - SUBSCRIBE: Subscribe to channel
   * - UNSUBSCRIBE: Unsubscribe from channel
   * - PING: Respond with PONG
   * - PONG: Update last ping time
   *
   * @param client - The client who sent the signal
   * @param message - The signal message
   * @throws MessageError if signal type is unknown
   * @throws ChannelError if channel operation fails
   *
   * @example
   * ```ts
   * try {
   *   await signalHandler.handleSignal(client, signalMessage)
   * } catch (error) {
   *   if (error instanceof ChannelError) {
   *     console.log('Channel error:', error.message)
   *   }
   * }
   * ```
   */
  async handleSignal(
    client: IServerClient,
    message: SignalMessage,
  ): Promise<void> {
    switch (message.signal) {
      case 'subscribe':
        await this.handleSubscribe(client, message)
        break

      case 'unsubscribe':
        await this.handleUnsubscribe(client, message)
        break

      case 'ping':
        await this.handlePing(client, message)
        break

      case 'pong':
        await this.handlePong(client, message)
        break

      default:
        throw new MessageError(`Unknown signal type: ${message.signal}`)
    }
  }

  /**
   * Handle SUBSCRIBE signal
   *
   * Process flow:
   * 1. Validate channel name
   * 2. Check if reserved channel (if not allowed)
   * 3. Execute subscribe middleware
   * 4. Subscribe to channel
   * 5. Emit subscribe event
   * 6. Send SUBSCRIBED acknowledgment
   *
   * @param client - The client
   * @param message - The signal message
   *
   * @example
   * ```ts
   * await signalHandler.handleSubscribe(client, {
   *   type: MessageType.SIGNAL,
   *   signal: SignalType.SUBSCRIBE,
   *   channel: 'chat'
   * })
   * ```
   */
  async handleSubscribe(
    client: IServerClient,
    message: SignalMessage,
  ): Promise<void> {
    const { channel } = message

    // Check for reserved channel
    if (!this.options.allowReservedChannels && isReservedChannelName(channel)) {
      throw new ChannelError(`Cannot subscribe to reserved channel: ${channel}`)
    }

    // Cannot subscribe to broadcast channel (it's for all clients)
    if (channel === BROADCAST_CHANNEL) {
      throw new ChannelError('Cannot subscribe to broadcast channel')
    }

    // Execute subscribe middleware
    await this.middleware.executeSubscribe(client, channel)

    // Get or find channel
    const channelInstance = this.channels.get(channel)
    if (!channelInstance) {
      throw new ChannelError(`Channel not found: ${channel}`)
    }

    // Check if channel is reserved
    if (channelInstance.isReserved() && !this.options.allowReservedChannels) {
      throw new ChannelError(`Cannot subscribe to reserved channel: ${channel}`)
    }

    // Check if channel is full
    if (channelInstance.isFull()) {
      throw new ChannelError(`Channel is full: ${channel}`)
    }

    // Subscribe to channel
    this.registry.subscribe(client.id, channel)

    // Emit subscribe event
    if (this.options.emitSubscribeEvent) {
      this.emitter.emit('subscribe', client, channel)
    }

    // Send acknowledgment
    if (this.options.sendAcknowledgments) {
      const ackMessage = createSignalMessage(
        channel,
        'subscribed' as SignalType,
        undefined,
        message.id,
      )
      await this.sendToClient(client.id, ackMessage)
    }
  }

  /**
   * Handle UNSUBSCRIBE signal
   *
   * Process flow:
   * 1. Execute unsubscribe middleware
   * 2. Unsubscribe from channel
   * 3. Emit unsubscribe event
   * 4. Send UNSUBSCRIBED acknowledgment
   *
   * @param client - The client
   * @param message - The signal message
   *
   * @example
   * ```ts
   * await signalHandler.handleUnsubscribe(client, {
   *   type: MessageType.SIGNAL,
   *   signal: SignalType.UNSUBSCRIBE,
   *   channel: 'chat'
   * })
   * ```
   */
  async handleUnsubscribe(
    client: IServerClient,
    message: SignalMessage,
  ): Promise<void> {
    const { channel } = message

    // Check if client is subscribed
    if (!this.registry.isSubscribed(client.id, channel)) {
      throw new ChannelError(`Client not subscribed to channel: ${channel}`)
    }

    // Execute unsubscribe middleware
    await this.middleware.executeUnsubscribe(client, channel)

    // Unsubscribe from channel
    this.registry.unsubscribe(client.id, channel)

    // Emit unsubscribe event
    if (this.options.emitUnsubscribeEvent) {
      this.emitter.emit('unsubscribe', client, channel)
    }

    // Send acknowledgment
    if (this.options.sendAcknowledgments) {
      const ackMessage = createSignalMessage(
        channel,
        'unsubscribed' as SignalType,
        undefined,
        message.id,
      )
      await this.sendToClient(client.id, ackMessage)
    }
  }

  /**
   * Handle PING signal
   *
   * Responds with PONG to keep connection alive.
   *
   * @param client - The client
   * @param message - The signal message
   *
   * @example
   * ```ts
   * await signalHandler.handlePing(client, {
   *   type: MessageType.SIGNAL,
   *   signal: SignalType.PING,
   *   channel: BROADCAST_CHANNEL
   * })
   * ```
   */
  async handlePing(
    client: IServerClient,
    message: SignalMessage,
  ): Promise<void> {
    if (this.options.autoRespondToPing) {
      const pongMessage = createSignalMessage(
        message.channel,
        'pong' as SignalType,
        undefined,
        message.id,
      )
      await this.sendToClient(client.id, pongMessage)
    }
  }

  /**
   * Handle PONG signal
   *
   * Updates the client's last ping time for health monitoring.
   *
   * @param client - The client
   * @param _message - The signal message
   *
   * @example
   * ```ts
   * await signalHandler.handlePong(client, {
   *   type: MessageType.SIGNAL,
   *   signal: SignalType.PONG,
   *   channel: BROADCAST_CHANNEL
   * })
   * ```
   */
  async handlePong(
    _client: IServerClient,
    _message: SignalMessage,
  ): Promise<void> {
    // PONG is handled - the client is still alive
    // The transport layer tracks last ping time
    // No action needed here besides successful execution
  }

  /**
   * Get handler options
   *
   * @returns Current handler options
   *
   * @example
   * ```ts
   * const options = signalHandler.getOptions()
   * console.log('Auto-respond to ping:', options.autoRespondToPing)
   * ```
   */
  getOptions(): Readonly<Required<SignalHandlerOptions>> {
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
export type { IMessageHandler, ILifecycleHandler } from '../types/base.js'
export type { IServerTransport } from '../types/transport.js'
export type { IChannelTransport } from '../types/channel.js'
export type {
  SignalMessage,
  SignalType,
  ChannelName,
  Message,
} from '@synnel/types'
