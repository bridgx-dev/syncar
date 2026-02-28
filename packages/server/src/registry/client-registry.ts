/**
 * Client Registry
 * Manages the lifecycle and subscriptions of connected clients.
 *
 * Uses bidirectional index for efficient lookups:
 * - subscriptions: ClientId → Channels (for disconnect cleanup)
 * - channels: ChannelName → Subscribers (for broadcasting)
 */

import type {
  IClientRegistry,
  IClientConnection,
  IChannel,
  ClientId,
  ChannelName,
} from '../types'
import { HandlerRegistry } from './handler-registry'

/**
 * Client Registry - manages connected clients and their subscriptions
 */
export class ClientRegistry implements IClientRegistry {
  /**
   * Shared map of all connected clients by ID
   */
  public readonly connections: Map<ClientId, IClientConnection> = new Map()

  /**
   * Client → Channels mapping (forward index)
   * Used for efficient disconnect cleanup
   */
  private readonly subscriptions: Map<ClientId, Set<ChannelName>> = new Map()

  /**
   * Channel → Subscribers mapping (reverse index)
   * Used for efficient broadcasting
   */
  private readonly channels: Map<ChannelName, Set<ClientId>> = new Map()

  /**
   * Handler registry for channel event handlers
   */
  public readonly handlers: HandlerRegistry = new HandlerRegistry()

  /**
   * Internal map of channel instances
   */
  private readonly channelInstances: Map<ChannelName, IChannel<any>> = new Map()


  // ============================================================
  // CLIENT REGISTRATION
  // ============================================================

  /**
   * Register a new client
   *
   * @param connection - The connection object
   * @returns The registered connection
   */
  register(connection: IClientConnection): IClientConnection {
    this.connections.set(connection.id, connection)
    return connection
  }

  /**
   * Unregister a client and cleanup all subscriptions
   *
   * Uses subscriptions map for O(1) lookup of client's channels
   *
   * @param clientId - Client ID to unregister
   * @returns true if client was found and removed, false otherwise
   */
  unregister(clientId: ClientId): boolean {
    const exists = this.connections.has(clientId)
    if (!exists) return false

    // Get all channels this client is subscribed to
    const clientChannels = this.subscriptions.get(clientId)
    if (clientChannels) {
      // Remove client from each channel
      for (const channelName of clientChannels) {
        const subscribers = this.channels.get(channelName)
        if (subscribers) {
          subscribers.delete(clientId)
          // Trigger unsubscribe handlers
          for (const handler of this.handlers.getUnsubscribeHandlers(channelName)) {
            try {
              handler(this.connections.get(clientId)!)
            } catch (error) {
              console.error(`Error in unsubscribe handler for ${channelName}:`, error)
            }
          }
        }
      }
      // Clear client's subscriptions
      this.subscriptions.delete(clientId)
    }

    // Remove from registry
    return this.connections.delete(clientId)
  }

  /**
   * Get a server client by ID
   *
   * @param clientId - Client ID to look up
   * @returns The connection or undefined if not found
   */
  get(clientId: ClientId): IClientConnection | undefined {
    return this.connections.get(clientId)
  }

  /**
   * Get all registered clients
   *
   * @returns Array of all connections
   */
  getAll(): IClientConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get the number of registered clients
   *
   * @returns Client count
   */
  getCount(): number {
    return this.connections.size
  }

  // ============================================================
  // CHANNEL MANAGEMENT
  // ============================================================

  /**
   * Register a channel instance
   *
   * @param channel - Channel instance to register
   */
  registerChannel(channel: IChannel<unknown>): void {
    // Create channel in internal map if not exists
    if (!this.channels.has(channel.name)) {
      this.channels.set(channel.name, new Set())
    }
    // Store the channel instance
    this.channelInstances.set(channel.name, channel)
  }

  /**
   * Get a channel instance by name (returns undefined in new architecture)
   *
   * In the new architecture, channels are managed internally.
   * This method is kept for backward compatibility.
   *
   * @param name - Channel name
   * @returns undefined (channels are managed internally)
   */
  getChannel<T = unknown>(name: ChannelName): IChannel<T> | undefined {
    return this.channelInstances.get(name) as IChannel<T> | undefined
  }

  /**
   * Remove a channel and all its subscriptions
   *
   * Cleans up both the channels map and all client subscriptions
   *
   * @param name - Channel name to remove
   * @returns true if channel was found and removed, false otherwise
   */
  removeChannel(name: ChannelName): boolean {
    const subscribers = this.channels.get(name)
    if (!subscribers) return false

    // Remove channel from all subscribers' subscription sets
    for (const clientId of subscribers) {
      const clientChannels = this.subscriptions.get(clientId)
      if (clientChannels) {
        clientChannels.delete(name)
      }
    }

    // Clear handlers for this channel
    this.handlers.clearChannel(name)

    // Remove the channel instance
    this.channelInstances.delete(name)

    // Remove the channel
    return this.channels.delete(name)
  }

  /**
   * Subscribe a client to a channel
   *
   * Updates BOTH maps to maintain bidirectional index:
   * - channels[channel].add(clientId)
   * - subscriptions[clientId].add(channel)
   *
   * @param clientId - Client ID to subscribe
   * @param channel - Channel name
   * @returns true if subscribed, false otherwise
   */
  subscribe(clientId: ClientId, channel: ChannelName): boolean {
    // Verify client exists
    if (!this.connections.has(clientId)) return false

    // Create channel if not exists
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set())
    }

    const subscribers = this.channels.get(channel)!

    // Check if already subscribed
    if (subscribers.has(clientId)) return false

    // Add to channels map (reverse index)
    subscribers.add(clientId)

    // Add to subscriptions map (forward index)
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Set())
    }
    this.subscriptions.get(clientId)!.add(channel)

    // Trigger subscribe handlers
    const client = this.connections.get(clientId)!
    for (const handler of this.handlers.getSubscribeHandlers(channel)) {
      try {
        handler(client)
      } catch (error) {
        console.error(`Error in subscribe handler for ${channel}:`, error)
      }
    }

    return true
  }

  /**
   * Unsubscribe a client from a channel
   *
   * Updates BOTH maps to maintain bidirectional index:
   * - channels[channel].delete(clientId)
   * - subscriptions[clientId].delete(channel)
   *
   * @param clientId - Client ID to unsubscribe
   * @param channel - Channel name
   * @returns true if unsubscribed, false otherwise
   */
  unsubscribe(clientId: ClientId, channel: ChannelName): boolean {
    const subscribers = this.channels.get(channel)
    if (!subscribers || !subscribers.has(clientId)) return false

    // Remove from channels map (reverse index)
    subscribers.delete(clientId)

    // Remove from subscriptions map (forward index)
    const clientChannels = this.subscriptions.get(clientId)
    if (clientChannels) {
      clientChannels.delete(channel)
      // Clean up empty subscription sets
      if (clientChannels.size === 0) {
        this.subscriptions.delete(clientId)
      }
    }

    // Trigger unsubscribe handlers
    const client = this.connections.get(clientId)
    if (client) {
      for (const handler of this.handlers.getUnsubscribeHandlers(channel)) {
        try {
          handler(client)
        } catch (error) {
          console.error(`Error in unsubscribe handler for ${channel}:`, error)
        }
      }
    }

    return true
  }

  /**
   * Get all subscribers for a channel
   *
   * @param channel - Channel name
   * @returns Array of subscribed connections
   */
  getSubscribers(channel: ChannelName): IClientConnection[] {
    const subscriberIds = this.channels.get(channel)
    if (!subscriberIds) return []

    const subscribers: IClientConnection[] = []
    for (const id of subscriberIds) {
      const client = this.connections.get(id)
      if (client) {
        subscribers.push(client)
      }
    }

    return subscribers
  }

  /**
   * Get subscriber count for a channel
   *
   * @param channel - Channel name
   * @returns Number of subscribers
   */
  getSubscriberCount(channel: ChannelName): number {
    return this.channels.get(channel)?.size ?? 0
  }

  /**
   * Get all active channel names
   *
   * @returns Array of channel names
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channels.keys())
  }

  /**
   * Get total subscription count across all channels
   *
   * @returns Total number of subscriptions
   */
  getTotalSubscriptionCount(): number {
    let total = 0
    for (const subscribers of this.channels.values()) {
      total += subscribers.size
    }
    return total
  }

  /**
   * Check if a client is subscribed to a channel
   *
   * @param clientId - Client ID to check
   * @param channel - Channel name
   * @returns true if subscribed, false otherwise
   */
  isSubscribed(clientId: ClientId, channel: ChannelName): boolean {
    return this.channels.get(channel)?.has(clientId) ?? false
  }

  /**
   * Get all channels a client is subscribed to
   *
   * @param clientId - Client ID
   * @returns Set of channel names
   */
  getClientChannels(clientId: ClientId): Set<ChannelName> {
    return this.subscriptions.get(clientId) ?? new Set()
  }

  /**
   * Get channel subscribers as a Set of client IDs
   *
   * @param channel - Channel name
   * @returns Set of subscriber IDs
   */
  getChannelSubscribers(channel: ChannelName): Set<ClientId> {
    return this.channels.get(channel) ?? new Set()
  }

  /**
   * Clear all clients and subscriptions
   */
  clear(): void {
    this.connections.clear()
    this.subscriptions.clear()
    this.channels.clear()
    this.handlers.clear()
  }
}
