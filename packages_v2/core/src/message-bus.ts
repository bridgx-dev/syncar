/**
 * MessageBus - Central event bus for managing channels and message routing
 * Provides pub/sub functionality for real-time communication
 */

import type { ChannelName, SubscriberId, DataPayload } from './types.js'
import type { Message } from './protocol.js'
import { Channel, type ChannelOptions } from './channel.js'

/**
 * Message handler type - receives message and optional sender ID
 */
export type MessageHandler<T = unknown> = (
  message: Message<T>,
  sender?: SubscriberId
) => void

/**
 * MessageBus options
 */
export interface MessageBusOptions {
  /**
   * Default options for created channels
   */
  defaultChannelOptions?: ChannelOptions

  /**
   * Whether to auto-create channels on subscribe
   * @default false
   */
  autoCreateChannels?: boolean

  /**
   * Whether to auto-delete empty channels
   * @default false
   */
  autoDeleteEmptyChannels?: boolean

  /**
   * Grace period before deleting empty channel (ms)
   * Only used if autoDeleteEmptyChannels is true
   * @default 5000
   */
  emptyChannelGracePeriod?: number
}

/**
 * MessageBus - Central hub for channel management and message routing
 */
export class MessageBus {
  protected readonly channels: Map<ChannelName, Channel> = new Map()
  protected readonly globalHandlers: Set<MessageHandler> = new Set()
  protected readonly options: Required<MessageBusOptions>
  protected pendingDeletions: Map<ChannelName, ReturnType<typeof setTimeout>> =
    new Map()

  constructor(options: MessageBusOptions = {}) {
    this.options = {
      defaultChannelOptions: options.defaultChannelOptions ?? {},
      autoCreateChannels: options.autoCreateChannels ?? false,
      autoDeleteEmptyChannels: options.autoDeleteEmptyChannels ?? false,
      emptyChannelGracePeriod: options.emptyChannelGracePeriod ?? 5000,
    }
  }

  /**
   * Create a new channel
   * @returns The created channel or undefined if channel already exists
   */
  createChannel(name: ChannelName, options?: ChannelOptions): Channel | undefined {
    if (this.channels.has(name)) {
      return undefined
    }

    if (!Channel.isValidChannelName(name)) {
      throw new Error(`Invalid channel name: ${name}`)
    }

    const channel = new Channel(name, {
      ...this.options.defaultChannelOptions,
      ...options,
    })

    this.channels.set(name, channel)
    return channel
  }

  /**
   * Get a channel by name
   * @returns The channel or undefined if not found
   */
  getChannel(name: ChannelName): Channel | undefined {
    return this.channels.get(name)
  }

  /**
   * Get or create a channel
   * @returns The existing or newly created channel
   */
  getOrCreateChannel(name: ChannelName, options?: ChannelOptions): Channel {
    let channel = this.channels.get(name)

    if (!channel) {
      if (this.options.autoCreateChannels || options) {
        channel = this.createChannel(name, options)
      }

      if (!channel) {
        throw new Error(`Channel not found: ${name}`)
      }
    }

    return channel
  }

  /**
   * Check if a channel exists
   */
  hasChannel(name: ChannelName): boolean {
    return this.channels.has(name)
  }

  /**
   * Get all channel names
   */
  getChannelNames(): ChannelName[] {
    return Array.from(this.channels.keys())
  }

  /**
   * Get all channels
   */
  getAllChannels(): Map<ChannelName, Channel> {
    return new Map(this.channels)
  }

  /**
   * Delete a channel
   * @returns true if channel was deleted, false if not found
   */
  deleteChannel(name: ChannelName): boolean {
    const channel = this.channels.get(name)

    if (channel) {
      // Cancel any pending deletion
      const pendingTimer = this.pendingDeletions.get(name)
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        this.pendingDeletions.delete(name)
      }

      channel.clear()
      return this.channels.delete(name)
    }

    return false
  }

  /**
   * Subscribe a subscriber to a channel
   * @returns true if subscription succeeded
   */
  subscribe(
    channelName: ChannelName,
    subscriber: SubscriberId
  ): boolean {
    const channel = this.getOrCreateChannel(channelName)
    return channel.subscribe(subscriber)
  }

  /**
   * Unsubscribe a subscriber from a channel
   * @returns true if unsubscription succeeded
   */
  unsubscribe(
    channelName: ChannelName,
    subscriber: SubscriberId
  ): boolean {
    const channel = this.getChannel(channelName)

    if (channel) {
      const result = channel.unsubscribe(subscriber)

      // Auto-delete empty channel if enabled
      if (
        this.options.autoDeleteEmptyChannels &&
        channel.isEmpty()
      ) {
        this.scheduleChannelDeletion(channelName)
      }

      return result
    }

    return false
  }

  /**
   * Unsubscribe a subscriber from all channels
   */
  unsubscribeAll(subscriber: SubscriberId): void {
    for (const channelName of this.getChannelNames()) {
      this.unsubscribe(channelName, subscriber)
    }
  }

  /**
   * Get all channels a subscriber is subscribed to
   */
  getSubscribedChannels(subscriber: SubscriberId): ChannelName[] {
    const subscribed: ChannelName[] = []

    for (const [name, channel] of this.channels) {
      if (channel.hasSubscriber(subscriber)) {
        subscribed.push(name)
      }
    }

    return subscribed
  }

  /**
   * Publish a message to a channel
   * @returns The number of subscribers the message was sent to
   */
  publish<T>(
    channelName: ChannelName,
    message: Message<T>,
    excludeSender?: SubscriberId
  ): number {
    const channel = this.getChannel(channelName)

    if (!channel) {
      return 0
    }

    // Add to history if enabled
    channel['addToHistory'](message)

    // Get subscribers
    const subscribers = Array.from(channel.getSubscribers()).filter(
      (id) => id !== excludeSender
    )

    // Notify global handlers
    for (const handler of this.globalHandlers) {
      handler(message, excludeSender)
    }

    return subscribers.length
  }

  /**
   * Broadcast a message to all subscribers across all channels
   */
  broadcast<T>(message: Message<T>, excludeSender?: SubscriberId): number {
    let totalRecipients = 0

    for (const channelName of this.getChannelNames()) {
      totalRecipients += this.publish(channelName, message, excludeSender)
    }

    return totalRecipients
  }

  /**
   * Add a global message handler (receives all messages)
   * @returns Unsubscribe function
   */
  onMessage(handler: MessageHandler): () => void {
    this.globalHandlers.add(handler)
    return () => {
      this.globalHandlers.delete(handler)
    }
  }

  /**
   * Schedule a channel for deletion (grace period)
   */
  protected scheduleChannelDeletion(name: ChannelName): void {
    // Cancel any existing deletion
    const existingTimer = this.pendingDeletions.get(name)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Schedule new deletion
    const timer = setTimeout(() => {
      const channel = this.getChannel(name)
      if (channel && channel.isEmpty()) {
        this.deleteChannel(name)
      }
      this.pendingDeletions.delete(name)
    }, this.options.emptyChannelGracePeriod)

    this.pendingDeletions.set(name, timer)
  }

  /**
   * Cancel pending channel deletion
   */
  protected cancelChannelDeletion(name: ChannelName): void {
    const timer = this.pendingDeletions.get(name)
    if (timer) {
      clearTimeout(timer)
      this.pendingDeletions.delete(name)
    }
  }

  /**
   * Get statistics about the message bus
   */
  getStats(): {
    totalChannels: number
    totalSubscribers: number
    channelStats: Array<{
      name: ChannelName
      subscribers: number
      reserved: boolean
    }>
  } {
    let totalSubscribers = 0
    const channelStats: Array<{
      name: ChannelName
      subscribers: number
      reserved: boolean
    }> = []

    for (const [name, channel] of this.channels) {
      const count = channel.getSubscriberCount()
      totalSubscribers += count
      channelStats.push({
        name,
        subscribers: count,
        reserved: channel.isReserved(),
      })
    }

    return {
      totalChannels: this.channels.size,
      totalSubscribers,
      channelStats,
    }
  }

  /**
   * Clear all channels and handlers
   */
  clear(): void {
    // Cancel all pending deletions
    for (const timer of this.pendingDeletions.values()) {
      clearTimeout(timer)
    }
    this.pendingDeletions.clear()

    // Clear all channels
    for (const channel of this.channels.values()) {
      channel.clear()
    }
    this.channels.clear()

    // Clear global handlers
    this.globalHandlers.clear()
  }
}
