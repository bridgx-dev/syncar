/**
 * Client Registry
 * Manages the lifecycle and subscriptions of connected clients.
 */

import type {
  IClientRegistry,
  IClientConnection,
  IChannelTransport,
  ClientId,
  ChannelName,
} from '../types'

/**
 * Client Registry - manages connected clients and their subscriptions
 */
export class ClientRegistry implements IClientRegistry {
  /**
   * Shared map of all connected clients by ID
   * This is shared with the transport layer for memory efficiency.
   */
  public readonly connections: Map<ClientId, IClientConnection> = new Map()


  /**
   * Map of channel instances by name
   */
  protected readonly channelInstances: Map<
    ChannelName,
    IChannelTransport<unknown>
  > = new Map()

  // ============================================================
  // CLIENT REGISTRATION
  // ============================================================

  /**
   * Register a new client
   *
   * @param connection - The connection object
   * @param transport - Transport layer for communication
   * @returns The registered connection
   */
  register(connection: IClientConnection): IClientConnection {
    // Add to shared connections map
    this.connections.set(connection.id, connection)

    return connection
  }

  /**
   * Unregister a client and cleanup all subscriptions
   *
   * @param clientId - Client ID to unregister
   * @returns true if client was found and removed, false otherwise
   */
  unregister(clientId: ClientId): boolean {
    const exists = this.connections.has(clientId)
    if (!exists) return false

    // Cleanup subscriptions from all channels
    for (const channel of this.channelInstances.values()) {
      channel.unsubscribe(clientId)
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
  registerChannel(channel: IChannelTransport<unknown>): void {
    this.channelInstances.set(channel.name, channel)
  }

  /**
   * Get a channel instance by name
   *
   * @param name - Channel name
   * @returns Channel instance or undefined if not found
   */
  getChannel<T = unknown>(name: ChannelName): IChannelTransport<T> | undefined {
    return this.channelInstances.get(name) as IChannelTransport<T> | undefined
  }

  /**
   * Remove a channel instance
   *
   * @param name - Channel name to remove
   * @returns true if channel was found and removed, false otherwise
   */
  removeChannel(name: ChannelName): boolean {
    return this.channelInstances.delete(name)
  }

  /**
   * Subscribe a client to a channel
   *
   * @param clientId - Client ID to subscribe
   * @param channel - Channel name
   * @returns true if subscribed, false otherwise
   */
  subscribe(clientId: ClientId, channel: ChannelName): boolean {
    const instance = this.getChannel(channel)
    if (!instance) return false

    return instance.subscribe(clientId)
  }

  /**
   * Unsubscribe a client from a channel
   *
   * @param clientId - Client ID to unsubscribe
   * @param channel - Channel name
   * @returns true if unsubscribed, false otherwise
   */
  unsubscribe(clientId: ClientId, channel: ChannelName): boolean {
    const instance = this.getChannel(channel)
    if (!instance) return false

    return instance.unsubscribe(clientId)
  }

  /**
   * Get all subscribers for a channel
   *
   * @param channel - Channel name
   * @returns Array of subscribed connections
   */
  getSubscribers(channel: ChannelName): IClientConnection[] {
    const instance = this.getChannel(channel)
    if (!instance) return []

    const subscriberIds = instance.getSubscribers()
    const subscribers: IClientConnection[] = []

    for (const id of subscriberIds) {
      const client = this.get(id)
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
    return this.getChannel(channel)?.subscriberCount ?? 0
  }

  /**
   * Get all active channel names
   *
   * @returns Array of channel names
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channelInstances.keys())
  }

  /**
   * Get total subscription count across all channels
   *
   * @returns Total number of subscriptions
   */
  getTotalSubscriptionCount(): number {
    let total = 0
    for (const channel of this.channelInstances.values()) {
      total += channel.subscriberCount
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
    return this.getChannel(channel)?.hasSubscriber(clientId) ?? false
  }

  /**
   * Clear all clients and subscriptions
   */
  clear(): void {
    // Cleanup subscriptions from channels
    for (const channel of this.channelInstances.values()) {
      for (const clientId of this.connections.keys()) {
        channel.unsubscribe(clientId)
      }
    }

    this.connections.clear()
    this.channelInstances.clear()
  }
}
