/**
 * Registry State Types
 * Pure data structures for registry state management.
 *
 * Uses bidirectional index for efficient lookups:
 * - subscriptions: ClientId → Channels (for disconnect cleanup)
 * - channels: ChannelName → Subscribers (for broadcasting)
 */

import type { IClientConnection } from '../types'
import type { ClientId, ChannelName } from '../types'

/**
 * Complete registry state
 * Can be serialized for inspection or persistence
 */
export interface RegistryState {
  /** All connected clients */
  clients: Map<ClientId, IClientConnection>

  /** Client → Channels mapping (forward index) */
  subscriptions: Map<ClientId, Set<ChannelName>>

  /** Channel → Subscribers mapping (reverse index, just the set) */
  channels: Map<ChannelName, Set<ClientId>>
}

/**
 * Create empty registry state
 */
export function createEmptyState(): RegistryState {
  return {
    clients: new Map(),
    subscriptions: new Map(),
    channels: new Map(),
  }
}

/**
 * Create a new channel
 * Does nothing if channel already exists
 *
 * @param state - The registry state
 * @param name - Channel name to create
 */
export function createChannel(state: RegistryState, name: ChannelName): void {
  if (!state.channels.has(name)) {
    state.channels.set(name, new Set())
  }
}

/**
 * Delete a channel
 * Cleans up the channel from both channels and subscriptions maps
 *
 * @param state - The registry state
 * @param name - Channel name to delete
 */
export function deleteChannel(state: RegistryState, name: ChannelName): void {
  // First, remove from all clients' subscriptions
  const subscribers = state.channels.get(name)
  if (subscribers) {
    for (const clientId of subscribers) {
      state.subscriptions.get(clientId)?.delete(name)
    }
  }

  // Remove the channel
  state.channels.delete(name)
}

/**
 * Get channel subscribers count
 * @param state - The registry state
 * @param name - Channel name
 * @returns Number of subscribers
 */
export function getChannelSubscriberCount(
  state: RegistryState,
  name: ChannelName,
): number {
  return state.channels.get(name)?.size ?? 0
}

/**
 * Get total subscription count across all channels
 * @param state - The registry state
 * @returns Total number of subscriptions
 */
export function getTotalSubscriptionCount(state: RegistryState): number {
  let total = 0
  for (const subscribers of state.channels.values()) {
    total += subscribers.size
  }
  return total
}

/**
 * Check if a client is subscribed to a channel
 * @param state - The registry state
 * @param clientId - Client ID to check
 * @param channel - Channel name to check
 * @returns true if subscribed, false otherwise
 */
export function isSubscribed(
  state: RegistryState,
  clientId: ClientId,
  channel: ChannelName,
): boolean {
  return state.channels.get(channel)?.has(clientId) ?? false
}

/**
 * Get subscribers for a channel
 * @param state - The registry state
 * @param name - Channel name
 * @returns Set of subscriber IDs
 */
export function getChannelSubscribers(
  state: RegistryState,
  name: ChannelName,
): Set<ClientId> {
  return state.channels.get(name) ?? new Set()
}

/**
 * Get channels a client is subscribed to
 * @param state - The registry state
 * @param clientId - Client ID
 * @returns Set of channel names
 */
export function getClientChannels(
  state: RegistryState,
  clientId: ClientId,
): Set<ChannelName> {
  return state.subscriptions.get(clientId) ?? new Set()
}
