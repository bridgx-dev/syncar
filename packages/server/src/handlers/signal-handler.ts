/**
 * Signal Handler
 * Processes signal messages (SUBSCRIBE, UNSUBSCRIBE, PING, PONG).
 */

import type {
  IClientRegistry,
  IClientConnection,
  IChannel,
  IMiddlewareManager,
  IEventEmitter,
  IServerEventMap,
  IChannelTransport,
  SignalMessage,
  ChannelName,
} from '../types'
import { createSignalMessage } from '../lib'
import { SignalType } from '../types'
import { ChannelError, MessageError } from '../errors'
import { BROADCAST_CHANNEL } from '../config'
import { isReservedChannelName } from '../lib'

/**
 * Signal handler options
 */
export interface SignalHandlerOptions {
  /**
   * Whether to require a valid channel for subscription and unsubscription
   * @default false
   */
  requireChannel?: boolean

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

  /**
   * Optional function to get a channel by name
   * If provided, this will be used to trigger channel handlers
   */
  getChannel?<T = unknown>(name: ChannelName): IChannel<T> | undefined
}

/**
 * Signal Handler
 * Processes signal messages from clients.
 */
export class SignalHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private readonly options: Required<SignalHandlerOptions>

  /**
   * Create a new signal handler
   */
  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    emitter: IEventEmitter<IServerEventMap>
    options?: SignalHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware
    this.emitter = dependencies.emitter

    // Apply defaults
    this.options = {
      requireChannel: dependencies.options?.requireChannel ?? false,
      emitSubscribeEvent: dependencies.options?.emitSubscribeEvent ?? true,
      emitUnsubscribeEvent: dependencies.options?.emitUnsubscribeEvent ?? true,
      allowReservedChannels:
        dependencies.options?.allowReservedChannels ?? false,
      sendAcknowledgments: dependencies.options?.sendAcknowledgments ?? true,
      autoRespondToPing: dependencies.options?.autoRespondToPing ?? true,
      getChannel: dependencies.options?.getChannel ?? ((name: ChannelName) => this.registry.getChannel(name)),
    }
  }

  /**
   * Handle a signal message from a client
   */
  async handleSignal(
    client: IClientConnection,
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
    client: IClientConnection,
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

    // Subscribe to channel via registry
    // Features like reserved channels, max subscribers, etc. are now
    // handled via onSubscribe callbacks that can reject the subscription
    const success = this.registry.subscribe(client.id, channel)
    if (!success) {
      throw new ChannelError(
        `Failed to subscribe client ${client.id} to channel ${channel}`,
      )
    }

    // Trigger channel subscribe handlers (if channel exists)
    const channelInstance = this.options.getChannel(channel)
    if (channelInstance) {
      try {
        await (channelInstance as IChannelTransport<unknown>).handleSubscribe(
          client,
        )
      } catch (error) {
        // If handler throws, unsubscribe and rethrow
        this.registry.unsubscribe(client.id, channel)
        throw error
      }
    } else if (this.options.requireChannel) {
      // If channel is required but not found, unsubscribe and throw
      this.registry.unsubscribe(client.id, channel)
      throw new ChannelError(
        `Channel "${channel}" not found`,
      )
    }

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
      client.socket.send(JSON.stringify(ackMessage), () => { })
    }
  }

  /**
   * Handle UNSUBSCRIBE signal
   */
  async handleUnsubscribe(
    client: IClientConnection,
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

    // Trigger channel unsubscribe handlers (if channel exists)
    const channelInstance = this.options.getChannel(channel)
    if (channelInstance) {
      await (channelInstance as IChannelTransport<unknown>).handleUnsubscribe(
        client,
      )
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
      client.socket.send(JSON.stringify(ackMessage), () => { })
    }
  }

  /**
   * Handle PING signal
   */
  async handlePing(
    client: IClientConnection,
    message: SignalMessage,
  ): Promise<void> {
    // Update client's last ping time
    client.lastPingAt = Date.now()

    // Auto-respond with PONG if enabled
    if (this.options.autoRespondToPing) {
      const pongMessage = createSignalMessage(
        message.channel,
        'pong' as SignalType,
        undefined,
        message.id,
      )
      client.socket.send(JSON.stringify(pongMessage), () => { })
    }
  }

  /**
   * Handle PONG signal
   */
  async handlePong(
    client: IClientConnection,
    _message: SignalMessage,
  ): Promise<void> {
    // PONG is received, connection is alive
    // The timestamp is already updated by the transport layer
    client.lastPingAt = Date.now()
  }

  /**
   * Get handler options
   */
  getOptions(): Readonly<Required<SignalHandlerOptions>> {
    return this.options
  }
}
