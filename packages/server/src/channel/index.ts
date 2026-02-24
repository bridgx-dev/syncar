/**
 * Channel Module
 * Channel-based messaging implementations for broadcast and multicast transports.
 *
 * @module channel
 */

// ============================================================
// BASE CHANNEL
// ============================================================

export { BaseChannel } from './base-channel.js'

// ============================================================
// BROADCAST TRANSPORT
// ============================================================

export { BroadcastTransport, BROADCAST_CHANNEL } from './broadcast-transport.js'

// ============================================================
// MULTICAST TRANSPORT
// ============================================================

export { MulticastTransport } from './multicast-transport.js'

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IChannel,
  IPublishOptions,
  IMessageHandler,
  ILifecycleHandler,
} from '../types/base.js'

export type {
  IChannelState,
  IChannelOptions,
  IMessageHistory,
  IChannelTransport,
  IBroadcastTransport,
  IMulticastTransport,
  IInternalChannelState,
  IMessageBusOptions,
} from '../types/channel.js'
