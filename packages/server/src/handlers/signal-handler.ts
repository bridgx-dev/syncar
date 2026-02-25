/**
 * Signal Handler
 * Processes signal messages (SUBSCRIBE, UNSUBSCRIBE, PING, PONG).
 */

import type { IClientRegistry } from '../types/client.js'
import type { IMiddlewareManager } from '../types/middleware.js'
import type { IEventEmitter } from '../types/events.js'
import type { IServerEventMap } from '../types/events.js'
import type { IServerClient } from '../types/client.js'
import type { IServerTransport } from '../types/transport.js'
import type {
  SignalMessage,
  SignalType,
} from '@synnel/types'
import {
  createSignalMessage,
} from '@synnel/lib'
import { ChannelError, MessageError } from '../errors/index.js'
import {
  BROADCAST_CHANNEL,
} from '../config/constants.js'
import { isReservedChannelName } from '@synnel/lib'

/**
 * Extract sendToClient method type from transport interface
 */
type SendToClientFn = IServerTransport['sendToClient']

/**
 * Signal handler options
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

/**
 * Signal Handler
 * Processes signal messages from clients.
 */
export class SignalHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private readonly sendToClient: SendToClientFn
  private readonly options: Required<SignalHandlerOptions>

  /**
   * Create a new signal handler
   */
  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    emitter: IEventEmitter<IServerEventMap>
    sendToClient: SendToClientFn
    options?: SignalHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware
    this.emitter = dependencies.emitter
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

    // Get channel instance from registry
    const channelInstance = this.registry.getChannel(channel)
    if (!channelInstance) {
      throw new ChannelError(`Channel not found: ${channel}`)
    }

    // Check if channel is reserved (if not allowed)
    if (channelInstance.isReserved() && !this.options.allowReservedChannels) {
      throw new ChannelError(`Cannot subscribe to reserved channel: ${channel}`)
    }

    // Check if channel is full
    if (channelInstance.isFull()) {
      throw new ChannelError(`Channel is full: ${channel}`)
    }

    // Subscribe to channel via registry
    const success = this.registry.subscribe(client.id, channel)
    if (!success) {
      throw new ChannelError(`Failed to subscribe client ${client.id} to channel ${channel}`)
    }

    // Trigger channel subscribe handlers
    await channelInstance.handleSubscribe(client)

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

    // Unsubscribe from channel via registry
    this.registry.unsubscribe(client.id, channel)

    // Trigger channel unsubscribe handlers
    const channelInstance = this.registry.getChannel(channel)
    if (channelInstance) {
      await channelInstance.handleUnsubscribe(client)
    }

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
   */
  async handlePong(
    _client: IServerClient,
    _message: SignalMessage,
  ): Promise<void> {
    // PONG is handled by transport layer for health monitoring
  }

  /**
   * Get handler options
   */
  getOptions(): Readonly<Required<SignalHandlerOptions>> {
    return this.options
  }
}
