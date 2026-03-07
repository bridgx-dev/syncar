import type {
  IClientConnection,
  IChannelTransport,
  SignalMessage,
} from '../types'

import { createSignalMessage, isReservedChannelName } from '../lib'
import { SignalType } from '../types'
import { ChannelError, MessageError } from '../errors'
import { BROADCAST_CHANNEL } from '../config'
import { ContextManager } from '../context'
import { ClientRegistry } from '../registry'

export interface SignalHandlerOptions {
  requireChannel?: boolean
  allowReservedChannels?: boolean
  sendAcknowledgments?: boolean
  autoRespondToPing?: boolean
}

export class SignalHandler {
  private readonly registry: ClientRegistry
  private readonly context: ContextManager
  private readonly options: Required<SignalHandlerOptions>

  constructor(dependencies: {
    registry: ClientRegistry
    context: ContextManager
    options?: SignalHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.context = dependencies.context

    // Apply defaults
    this.options = {
      requireChannel: dependencies.options?.requireChannel ?? false,
      allowReservedChannels:
        dependencies.options?.allowReservedChannels ?? false,
      sendAcknowledgments: dependencies.options?.sendAcknowledgments ?? true,
      autoRespondToPing: dependencies.options?.autoRespondToPing ?? true,
    }
  }

  async handleSignal(
    client: IClientConnection,
    message: SignalMessage,
  ): Promise<void> {
    // 1. Create Context based on signal
    let ctx

    if (message.signal === SignalType.SUBSCRIBE) {
      ctx = this.context.createSubscribeContext(client, message.channel!)
    } else if (message.signal === SignalType.UNSUBSCRIBE) {
      ctx = this.context.createUnsubscribeContext(client, message.channel!)
    } else {
      ctx = this.context.createMessageContext(client, message)
    }

    // 3. Define Kernel
    const kernel = async () => {
      switch (message.signal) {
        case SignalType.SUBSCRIBE:
          await this.handleSubscribe(client, message)
          break

        case SignalType.UNSUBSCRIBE:
          await this.handleUnsubscribe(client, message)
          break

        case SignalType.PING:
          await this.handlePing(client, message)
          break

        case SignalType.PONG:
          await this.handlePong(client, message)
          break

        default:
          throw new MessageError(`Unknown signal type: ${message.signal}`)
      }
    }

    // 4. Execute Onion (Global Middleware)
    await this.context.execute(ctx, this.context.getMiddlewares(), kernel)
  }

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
    const channelInstance = this.registry.getChannel(channel)

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
      throw new ChannelError(`Channel "${channel}" not found`)
    }

    // Send acknowledgment
    if (this.options.sendAcknowledgments) {
      const ackMessage = createSignalMessage(
        channel,
        SignalType.SUBSCRIBED,
        undefined,
        message.id,
      )
      client.socket.send(JSON.stringify(ackMessage), () => { })
    }
  }

  async handleUnsubscribe(
    client: IClientConnection,
    message: SignalMessage,
  ): Promise<void> {
    const { channel } = message

    // Check if client is subscribed
    if (!this.registry.isSubscribed(client.id, channel)) {
      throw new ChannelError(`Client not subscribed to channel: ${channel}`)
    }

    // Unsubscribe from channel via registry
    this.registry.unsubscribe(client.id, channel)

    // Trigger channel unsubscribe handlers (if channel exists)
    const channelInstance = this.registry.getChannel(channel)

    if (channelInstance) {
      await (channelInstance as IChannelTransport<unknown>).handleUnsubscribe(
        client,
      )
    }

    // Send acknowledgment
    if (this.options.sendAcknowledgments) {
      const ackMessage = createSignalMessage(
        channel,
        SignalType.UNSUBSCRIBED,
        undefined,
        message.id,
      )
      client.socket.send(JSON.stringify(ackMessage), () => { })
    }
  }

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
        SignalType.PONG,
        undefined,
        message.id,
      )
      client.socket.send(JSON.stringify(pongMessage), () => { })
    }
  }

  async handlePong(
    client: IClientConnection,
    _message: SignalMessage,
  ): Promise<void> {
    // PONG is received, connection is alive
    // The timestamp is already updated by the transport layer
    client.lastPingAt = Date.now()
  }

  getOptions(): Readonly<Required<SignalHandlerOptions>> {
    return this.options
  }
}
