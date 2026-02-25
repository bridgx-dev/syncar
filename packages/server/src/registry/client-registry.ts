/**
 * Client Registry
 * Manages the lifecycle and subscriptions of connected clients.
 */

import type {
  IClientRegistry,
  IClientData,
  IServerClient,
} from '../types/client.js'
import type { IClientConnection } from '../types/base.js'
import type { IServerTransport } from '../types/transport.js'
import type { IChannelTransport } from '../types/channel.js'
import type {
  ClientId,
  ChannelName,
  Message,
} from '@synnel/types'

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
   * Map of server client wrappers
   */
  protected readonly serverClients: Map<ClientId, IServerClient> = new Map()

  /**
   * Map of channel instances by name
   */
  protected readonly channelInstances: Map<ChannelName, IChannelTransport<unknown>> = new Map()

  // ============================================================
  // CLIENT REGISTRATION
  // ============================================================

  /**
   * Register a new client
   *
   * @param connection - The connection object
   * @param transport - Transport layer for communication
   * @returns Server client wrapper
   */
  register(
    connection: IClientConnection,
    transport: IServerTransport,
  ): IServerClient {
    // Add to shared connections map
    this.connections.set(connection.id, connection)

    // Create and store server client wrapper
    const client = this.createServerClient(connection, transport)
    this.serverClients.set(connection.id, client)

    return client
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
    this.serverClients.delete(clientId)
    return this.connections.delete(clientId)
  }

  /**
   * Get a server client by ID
   *
   * @param clientId - Client ID to look up
   * @returns Server client or undefined if not found
   */
  get(clientId: ClientId): IServerClient | undefined {
    return this.serverClients.get(clientId)
  }

  /**
   * Get all registered clients
   *
   * @returns Array of all server clients
   */
  getAll(): IServerClient[] {
    return Array.from(this.serverClients.values())
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
   * @returns Array of subscribed clients
   */
  getSubscribers(channel: ChannelName): IServerClient[] {
    const instance = this.getChannel(channel)
    if (!instance) return []

    const subscriberIds = instance.getSubscribers()
    const subscribers: IServerClient[] = []

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
    this.serverClients.clear()
    this.channelInstances.clear()
  }

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================

  /**
   * Create a server client wrapper
   *
   * @param connection - The connection object
   * @param transport - Transport layer for communication
   * @returns Server client wrapper
   */
  protected createServerClient(
    connection: IClientConnection,
    transport: IServerTransport,
  ): IServerClient {
    const registry = this

    return {
      id: connection.id,
      connectedAt: connection.connectedAt,
      lastPingAt: connection.lastPingAt,
      socket: connection.socket,

      send: async (message: Message): Promise<void> => {
        await transport.sendToClient(connection.id, message)
      },

      disconnect: async (code?: number, reason?: string): Promise<void> => {
        const socket = connection.socket as unknown as { close: (code: number, reason?: string) => void }
        socket.close(code ?? 1000, reason ?? 'Disconnected')
      },

      getSubscriptions: (): ChannelName[] => {
        const subscriptions: ChannelName[] = []
        for (const [name, instance] of registry.channelInstances.entries()) {
          if (instance.hasSubscriber(connection.id)) {
            subscriptions.push(name)
          }
        }
        return subscriptions
      },

      hasSubscription: (channel: ChannelName): boolean => {
        return registry.isSubscribed(connection.id, channel)
      },
    }
  }
}
