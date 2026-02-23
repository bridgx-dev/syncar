/**
 * Channel related types
 */

import type { ChannelName, SubscriberId, Timestamp } from './common.js'

/**
 * Channel state information
 */
export interface ChannelState<T = unknown> {
  name: ChannelName
  subscriberCount: number
  createdAt: Timestamp
  lastMessageAt?: Timestamp
}

/**
 * Subscription state
 */
export interface SubscriptionState {
  id: string
  channel: ChannelName
  subscriber: SubscriberId
  active: boolean
  subscribedAt: Timestamp
}

/**
 * Channel options
 */
export interface ChannelOptions {
  /**
   * Maximum number of subscribers (0 = unlimited)
   * @default 0
   */
  maxSubscribers?: number

  /**
   * Whether this channel is reserved (system use only)
   * @default false
   */
  reserved?: boolean

  /**
   * Message history size (0 = no history)
   * @default 0
   */
  historySize?: number
}

/**
 * Message bus options
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
