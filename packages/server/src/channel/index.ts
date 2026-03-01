/**
 * Channel Module
 * Channel-based messaging implementations.
 *
 * @module channel
 */

// Lightweight channel reference
export { MulticastChannel } from './multicast'

// Broadcast channel (special case - sends to all clients)
export { BroadcastChannel } from './broadcast'
