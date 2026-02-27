/**
 * Channel Module
 * Channel-based messaging implementations.
 *
 * @module channel
 */

// Lightweight channel reference
export { ChannelRef } from './channel-ref'

// Broadcast channel (special case - sends to all clients)
export { BroadcastChannel } from './broadcast-channel'
