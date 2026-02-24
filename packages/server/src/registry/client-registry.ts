/**
 * Client Registry
 * Manages the lifecycle and subscriptions of connected clients.
 *
 * Provides efficient CRUD operations for clients and subscriptions
 * with proper type safety throughout.
 *
 * @module registry/client-registry
 */

import type {
  IClientRegistry,
  IClientData,
  IServerClient,
} from '../types/client.js'
import type { IClientConnection } from '../types/base.js'
import type { IServerTransport } from '../types/transport.js'
import type {
  ClientId,
  ChannelName,
  Message,
} from '@synnel/types'

// ============================================================
// CLIENT REGISTRY CLASS
// ============================================================

/**
 * Client Registry - manages connected clients and their subscriptions
 *
 * Provides efficient CRUD operations for clients and subscriptions.
 * Uses Map-based storage for O(1) lookups and maintains a reverse index
 * for channel-to-clients lookups.
 *
 * @example
 * ```ts
 * import { ClientRegistry } from '@synnel/server/registry'
 *
 * const registry = new ClientRegistry()
 *
 * // Register a new client
 * const client = registry.register(clientId, transport, connection)
 *
 * // Subscribe to channel
 * registry.subscribe(clientId, 'chat')
 *
 * // Get client by ID
 * const foundClient = registry.get(clientId)
 *
 * // Get channel subscribers
 * const subscribers = registry.getSubscribers('chat')
 * ```
 */
export class ClientRegistry implements IClientRegistry {
  /**
   * Client data storage indexed by client ID
   * Contains: id, transport, subscriptions
   */
  protected readonly clients: Map<ClientId, IClientData> = new Map()

  /**
   * Reverse index: channel -> set of subscribed client IDs
   * Enables efficient channel-to-clients lookups
   */
  protected readonly channelSubscribers: Map<ChannelName, Set<ClientId>> = new Map()

  // ============================================================
  // SERVER CLIENT FACTORY METHOD
  // ============================================================

  /**
   * Create a server client wrapper from internal data
   *
   * This method avoids creating closures on each call by returning
   * a new object with methods that reference the captured clientData
   * and registry (this).
   *
   * @param clientData - Internal client data
   * @param connection - The connection object
   * @returns Server client wrapper
   *
   * @example
   * ```ts
   * // Internal use within ClientRegistry
   * const serverClient = this.createServerClient(clientData, connection)
   * ```
   */
  protected createServerClient(
    clientData: IClientData,
    connection: IClientConnection,
  ): IServerClient {
    const registry = this // Capture reference for closure

    return {
      // IClientConnection properties (readonly)
      id: connection.id,
      connectedAt: connection.connectedAt,
      lastPingAt: connection.lastPingAt,
      socket: connection.socket,

      // IServerClient methods
      send: async (message: Message): Promise<void> => {
        await clientData.transport.sendToClient(clientData.id, message)
      },

      disconnect: async (code?: number, reason?: string): Promise<void> => {
        const conn = clientData.transport.connections.get(clientData.id)
        if (conn?.socket) {
          const socket = conn.socket as unknown as { close: (code: number, reason?: string) => void }
          socket.close(code ?? 1000, reason ?? 'Disconnected')
        }
      },

      getSubscriptions: (): ChannelName[] => {
        return Array.from(clientData.subscriptions)
      },

      hasSubscription: (channel: ChannelName): boolean => {
        return registry.isSubscribed(clientData.id, channel)
      },
    }
  }

  // ============================================================
  // CLIENT CRUD METHODS (implements IClientRegistry)
  // ============================================================

  /**
   * Register a new client
   *
   * @param clientId - Unique client identifier
   * @param transport - Transport layer for communication
   * @param connection - The connection object
   * @returns Server client wrapper
   *
   * @example
   * ```ts
   * const client = registry.register('client-123', transport, connection)
   * ```
   */
  register(
    clientId: ClientId,
    transport: IServerTransport,
    connection: IClientConnection,
  ): IServerClient {
    const clientData: IClientData = {
      id: clientId,
      transport,
      subscriptions: new Set(),
    }

    this.clients.set(clientId, clientData)

    // Create server client wrapper
    const serverClient = this.createServerClient(clientData, connection)
    return serverClient
  }

  /**
   * Unregister a client
   *
   * Removes the client from the registry and cleans up all channel subscriptions.
   *
   * @param clientId - Client to unregister
   * @returns true if client was found and removed, false otherwise
   *
   * @example
   * ```ts
   * const removed = registry.unregister('client-123')
   * if (removed) {
   *   console.log('Client unregistered')
   * }
   * ```
   */
  unregister(clientId: ClientId): boolean {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return false
    }

    // Remove from all channel subscriptions
    for (const channel of clientData.subscriptions) {
      const subscribers = this.channelSubscribers.get(channel)
      if (subscribers) {
        subscribers.delete(clientId)
        if (subscribers.size === 0) {
          this.channelSubscribers.delete(channel)
        }
      }
    }

    this.clients.delete(clientId)
    return true
  }

  /**
   * Get a client by ID
   *
   * Returns a ServerClient wrapper that provides methods for interacting
   * with the client. The wrapper is created on-demand without creating
   * new closures.
   *
   * @param clientId - Client ID to look up
   * @returns Server client or undefined if not found
   *
   * @example
   * ```ts
   * const client = registry.get('client-123')
   * if (client) {
   *   await client.send({ type: 'data', data: 'Hello!' })
   * }
   * ```
   */
  get(clientId: ClientId): IServerClient | undefined {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return undefined
    }

    const connection = clientData.transport.connections.get(clientId)
    if (!connection) {
      return undefined
    }

    return this.createServerClient(clientData, connection)
  }

  /**
   * Get all registered clients
   *
   * Returns an array of all active server clients.
   *
   * @returns Array of all server clients
   *
   * @example
   * ```ts
   * const clients = registry.getAll()
   * console.log(`Total clients: ${clients.length}`)
   * ```
   */
  getAll(): IServerClient[] {
    const clients: IServerClient[] = []

    for (const [clientId, clientData] of this.clients) {
      const connection = clientData.transport.connections.get(clientId)
      if (connection) {
        clients.push(this.createServerClient(clientData, connection))
      }
    }

    return clients
  }

  /**
   * Get the number of registered clients
   *
   * @returns Client count
   *
   * @example
   * ```ts
   * console.log(`Connected clients: ${registry.getCount()}`)
   * ```
   */
  getCount(): number {
    return this.clients.size
  }

  // ============================================================
  // SUBSCRIPTION METHODS (implements IClientRegistry)
  // ============================================================

  /**
   * Subscribe a client to a channel
   *
   * @param clientId - Client to subscribe
   * @param channel - Channel to subscribe to
   * @returns true if subscription succeeded, false otherwise
   *
   * @example
   * ```ts
   * const success = registry.subscribe('client-123', 'chat')
   * if (success) {
   *   console.log('Subscribed to chat')
   * }
   * ```
   */
  subscribe(clientId: ClientId, channel: ChannelName): boolean {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return false
    }

    // Add to client's subscriptions
    clientData.subscriptions.add(channel)

    // Add to channel subscribers
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set())
    }
    this.channelSubscribers.get(channel)!.add(clientId)

    return true
  }

  /**
   * Unsubscribe a client from a channel
   *
   * @param clientId - Client to unsubscribe
   * @param channel - Channel to unsubscribe from
   * @returns true if unsubscription succeeded, false otherwise
   *
   * @example
   * ```ts
   * const success = registry.unsubscribe('client-123', 'chat')
   * if (success) {
   *   console.log('Unsubscribed from chat')
   * }
   * ```
   */
  unsubscribe(clientId: ClientId, channel: ChannelName): boolean {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return false
    }

    // Remove from client's subscriptions
    const removed = clientData.subscriptions.delete(channel)

    // Remove from channel subscribers
    const subscribers = this.channelSubscribers.get(channel)
    if (subscribers) {
      subscribers.delete(clientId)
      if (subscribers.size === 0) {
        this.channelSubscribers.delete(channel)
      }
    }

    return removed
  }

  /**
   * Get all subscribers for a channel
   *
   * Returns an array of server clients subscribed to the specified channel.
   *
   * @param channel - Channel name
   * @returns Array of subscribed clients
   *
   * @example
   * ```ts
   * const chatUsers = registry.getSubscribers('chat')
   * console.log(`Chat users: ${chatUsers.length}`)
   * ```
   */
  getSubscribers(channel: ChannelName): IServerClient[] {
    const subscriberIds = this.channelSubscribers.get(channel)
    if (!subscriberIds) {
      return []
    }

    const clients: IServerClient[] = []

    for (const clientId of subscriberIds) {
      const clientData = this.clients.get(clientId)
      if (clientData) {
        const connection = clientData.transport.connections.get(clientId)
        if (connection) {
          clients.push(this.createServerClient(clientData, connection))
        }
      }
    }

    return clients
  }

  /**
   * Get subscriber count for a channel
   *
   * @param channel - Channel name
   * @returns Number of subscribers
   *
   * @example
   * ```ts
   * console.log(`Chat subscribers: ${registry.getSubscriberCount('chat')}`)
   * ```
   */
  getSubscriberCount(channel: ChannelName): number {
    return this.channelSubscribers.get(channel)?.size ?? 0
  }

  /**
   * Get all channels that have subscribers
   *
   * @returns Array of channel names
   *
   * @example
   * ```ts
   * const channels = registry.getChannels()
   * console.log(`Active channels: ${channels.join(', ')}`)
   * ```
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channelSubscribers.keys())
  }

  /**
   * Get total subscription count across all channels
   *
   * @returns Total number of subscriptions
   *
   * @example
   * ```ts
   * console.log(`Total subscriptions: ${registry.getTotalSubscriptionCount()}`)
   * ```
   */
  getTotalSubscriptionCount(): number {
    let count = 0
    for (const subscribers of this.channelSubscribers.values()) {
      count += subscribers.size
    }
    return count
  }

  /**
   * Check if a client is subscribed to a channel
   *
   * @param clientId - Client ID to check
   * @param channel - Channel to check
   * @returns true if subscribed, false otherwise
   *
   * @example
   * ```ts
   * if (registry.isSubscribed('client-123', 'chat')) {
   *   console.log('Client is in chat')
   * }
   * ```
   */
  isSubscribed(clientId: ClientId, channel: ChannelName): boolean {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return false
    }
    return clientData.subscriptions.has(channel)
  }

  /**
   * Clear all clients and subscriptions
   *
   * Useful for server shutdown or testing.
   *
   * @example
   * ```ts
   * registry.clear()
   * console.log('Registry cleared')
   * ```
   */
  clear(): void {
    this.clients.clear()
    this.channelSubscribers.clear()
  }
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IClientRegistry,
  IClientData,
  IServerClient,
  IServerClientFactory,
} from '../types/client.js'

export type { IClientConnection } from '../types/base.js'

export type { IServerTransport } from '../types/transport.js'

export type {
  ClientId,
  ChannelName,
  Message,
  Timestamp,
} from '@synnel/types'
