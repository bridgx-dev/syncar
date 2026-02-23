/**
 * Message Handler
 * Handles incoming message routing and signal processing
 * Extracted from server for better separation of concerns
 */

import type {
  Message,
  DataMessage,
  ChannelName,
  SignalType,
  MessageType,
} from '@synnel/types'
import { SignalType as CoreSignalType } from '@synnel/types'
import type { MulticastTransport } from './types.js'
import type { ServerClient } from './types.js'
import type { ClientRegistry } from './client-registry.js'
import type { MiddlewareManager } from './middleware.js'
import type { MiddlewareRejectionError } from './middleware.js'

/**
 * Context for message handling
 * Provides access to server resources needed by the handler
 */
export interface MessageHandlerContext {
  /** Get a client by ID */
  getClient(clientId: string): ServerClient | undefined
  /** Get or create a multicast transport */
  getOrCreateMulticast(channel: ChannelName): MulticastTransport
  /** Get a multicast transport if it exists */
  getMulticast(channel: ChannelName): MulticastTransport | undefined
  /** Get all multicast transports */
  getAllMulticasts(): Map<ChannelName, MulticastTransport>
  /** Emit events */
  emit(event: string, ...args: unknown[]): void
  /** Increment received message counter */
  incrementReceivedCount(): void
  /** Increment sent message counter */
  incrementSentCount(): void
}

/**
 * Options for MessageHandler
 */
export interface MessageHandlerOptions {
  /** Registry for managing clients and subscriptions */
  registry: ClientRegistry
  /** Middleware manager for processing messages */
  middleware: MiddlewareManager
}

/**
 * Result of handling a message
 */
export interface MessageHandleResult {
  /** Whether the message was handled successfully */
  success: boolean
  /** Error message if handling failed */
  error?: string
  /** Whether the message should be relayed to other subscribers */
  shouldRelay: boolean
}

/**
 * MessageHandler - Routes incoming messages to appropriate channels
 * and handles signals (subscribe, unsubscribe, ping)
 */
export class MessageHandler {
  protected readonly context: MessageHandlerContext
  protected readonly registry: ClientRegistry
  protected readonly middleware: MiddlewareManager

  constructor(options: MessageHandlerOptions, context: MessageHandlerContext) {
    this.registry = options.registry
    this.middleware = options.middleware
    this.context = context
  }

  /**
   * Handle an incoming message from a client
   * Routes to appropriate handler based on message type
   */
  async handleMessage(
    clientId: string,
    message: Message,
  ): Promise<MessageHandleResult> {
    // Increment received counter
    this.context.incrementReceivedCount()

    // Get the client
    const client = this.context.getClient(clientId)
    if (!client) {
      return { success: false, error: 'Client not found', shouldRelay: false }
    }

    // Execute message middleware
    try {
      await this.middleware.executeMessage(client, message)
    } catch (error) {
      if (error instanceof MiddlewareRejectionError) {
        // Send error to client
        await client.send({
          id: message.id,
          type: 'error' as MessageType,
          data: {
            message: error.reason,
            code: 'REJECTED',
          },
          timestamp: Date.now(),
        })
        return { success: false, error: error.reason, shouldRelay: false }
      }
      return { success: false, error: String(error), shouldRelay: false }
    }

    // Route based on message type
    if (message.type === 'data') {
      return await this.handleDataMessage(client, message as DataMessage)
    } else if (message.type === 'signal') {
      return await this.handleSignalMessage(
        client,
        message.signal as SignalType,
        message.channel,
      )
    }

    // Emit message event for other types
    this.context.emit('message', client, message)
    return { success: true, shouldRelay: false }
  }

  /**
   * Handle a data message
   * Routes to the appropriate multicast channel
   */
  protected async handleDataMessage(
    client: ServerClient,
    message: DataMessage,
  ): Promise<MessageHandleResult> {
    const channel = message.channel

    // Check if channel is specified
    if (!channel) {
      // Send error to client
      await client.send({
        id: message.id,
        type: 'error' as MessageType,
        data: {
          message: 'Channel is required for data messages',
          code: 'MISSING_CHANNEL',
        },
        timestamp: Date.now(),
      })
      return { success: false, error: 'Missing channel', shouldRelay: false }
    }

    // Handle broadcast channel
    if (channel === '__broadcast__') {
      this.context.emit('message', client, message)
      return { success: true, shouldRelay: false }
    }

    // Get multicast transport
    const multicast = this.context.getMulticast(channel)
    if (!multicast) {
      // Channel doesn't exist, but we still emit the event
      this.context.emit('message', client, message)
      return { success: true, shouldRelay: false }
    }

    // Emit message event
    this.context.emit('message', client, message)

    // Trigger server-side handlers
    try {
      await multicast.handleMessage(message.data, client, message)
    } catch (error) {
      console.error(`Error in message handler for channel ${channel}:`, error)
    }

    return { success: true, shouldRelay: true }
  }

  /**
   * Handle a signal message
   * Processes subscribe, unsubscribe, and ping signals
   */
  protected async handleSignalMessage(
    client: ServerClient,
    signal: SignalType,
    channel: ChannelName | undefined,
  ): Promise<MessageHandleResult> {
    if (!channel) {
      return { success: false, error: 'Channel required for signal', shouldRelay: false }
    }

    if (signal === CoreSignalType.SUBSCRIBE) {
      return await this.handleSubscribe(client, channel)
    } else if (signal === CoreSignalType.UNSUBSCRIBE) {
      return await this.handleUnsubscribe(client, channel)
    } else if (signal === CoreSignalType.PING) {
      return await this.handlePing(client)
    }

    return { success: false, error: 'Unknown signal type', shouldRelay: false }
  }

  /**
   * Handle subscribe signal
   */
  protected async handleSubscribe(
    client: ServerClient,
    channel: ChannelName,
  ): Promise<MessageHandleResult> {
    // Broadcast channel is always allowed
    if (channel === '__broadcast__') {
      await this.sendSignal(client, 'subscribed' as SignalType, channel)
      return { success: true, shouldRelay: false }
    }

    // Execute subscribe middleware
    try {
      await this.middleware.executeSubscribe(client, channel)
    } catch (error) {
      if (error instanceof MiddlewareRejectionError) {
        await this.sendError(client, error.reason, 'SUBSCRIBE_REJECTED')
        return { success: false, error: error.reason, shouldRelay: false }
      }
      return { success: false, error: String(error), shouldRelay: false }
    }

    // Get or create multicast transport
    const multicast = this.context.getOrCreateMulticast(channel)

    // Subscribe to channel in registry
    const subscribed = this.registry.subscribe(client.id, channel)

    if (subscribed) {
      // Subscribe to multicast transport
      multicast.subscribe(client.id)

      // Call handleSubscribe
      await multicast.handleSubscribe(client)

      // Send subscribed signal
      await this.sendSignal(client, 'subscribed' as SignalType, channel)

      // Emit subscribe event
      this.context.emit('subscribe', client, channel)
    }

    return { success: true, shouldRelay: false }
  }

  /**
   * Handle unsubscribe signal
   */
  protected async handleUnsubscribe(
    client: ServerClient,
    channel: ChannelName,
  ): Promise<MessageHandleResult> {
    // Execute unsubscribe middleware
    try {
      await this.middleware.executeUnsubscribe(client, channel)
    } catch (error) {
      if (error instanceof MiddlewareRejectionError) {
        await this.sendError(client, error.reason, 'UNSUBSCRIBE_REJECTED')
        return { success: false, error: error.reason, shouldRelay: false }
      }
      return { success: false, error: String(error), shouldRelay: false }
    }

    // Unsubscribe from channel
    const unsubscribed = this.registry.unsubscribe(client.id, channel)

    if (unsubscribed) {
      const multicast = this.context.getMulticast(channel)
      if (multicast) {
        // Unsubscribe from multicast transport
        multicast.unsubscribe(client.id)

        // Call handleUnsubscribe
        await multicast.handleUnsubscribe(client)
      }

      // Send unsubscribed signal
      await this.sendSignal(client, 'unsubscribed' as SignalType, channel)

      // Emit unsubscribe event
      this.context.emit('unsubscribe', client, channel)
    }

    return { success: true, shouldRelay: false }
  }

  /**
   * Handle ping signal
   */
  protected async handlePing(client: ServerClient): Promise<MessageHandleResult> {
    await client.send({
      id: `pong-${Date.now()}`,
      type: 'signal' as MessageType,
      signal: 'pong' as SignalType,
      timestamp: Date.now(),
    })
    return { success: true, shouldRelay: false }
  }

  /**
   * Handle client disconnection
   * Unsubscribes from all channels and triggers handlers
   */
  async handleDisconnection(clientId: string): Promise<void> {
    const client = this.context.getClient(clientId)
    if (!client) {
      return
    }

    // Execute disconnect middleware
    try {
      await this.middleware.executeConnection(client, 'disconnect')
    } catch {
      // Ignore middleware errors during disconnect
    }

    // Unsubscribe from all channels
    const subscriptions = client.getSubscriptions()
    for (const channelName of subscriptions) {
      const multicast = this.context.getMulticast(channelName)
      if (multicast) {
        // Call unsubscribe handlers
        await multicast.handleUnsubscribe(client)
      }
    }

    // Note: Actual unregistration from registry is done by the server
    // after calling this method
  }

  /**
   * Send a signal message to a client
   */
  protected async sendSignal(
    client: ServerClient,
    signal: SignalType,
    channel: ChannelName,
  ): Promise<void> {
    await client.send({
      id: `signal-${Date.now()}`,
      type: 'signal' as MessageType,
      signal,
      channel,
      timestamp: Date.now(),
    })
  }

  /**
   * Send an error message to a client
   */
  protected async sendError(
    client: ServerClient,
    message: string,
    code: string,
  ): Promise<void> {
    await client.send({
      id: `error-${Date.now()}`,
      type: 'error' as MessageType,
      data: {
        message,
        code,
      },
      timestamp: Date.now(),
    })
  }

  /**
   * Relay a data message to all subscribers except the sender
   * Called after message handlers have been triggered
   */
  async relayMessage(
    channel: ChannelName,
    data: unknown,
    excludeClientId: string,
  ): Promise<void> {
    const multicast = this.context.getMulticast(channel)
    if (!multicast) {
      return
    }

    // Publish to all subscribers except sender
    multicast.publish(data, excludeClientId)
  }
}
