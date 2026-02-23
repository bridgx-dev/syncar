/**
 * Client Registry
 * Manages connected clients and their subscriptions
 */

import type { ServerClient, ServerTransport } from './types.js'
import type { ChannelName, Message } from '@synnel/core'
import type { ClientConnection } from '@synnel/core/ws-server'

/**
 * Internal client data structure
 */
interface ClientData {
  id: string
  transport: ServerTransport
  subscriptions: Set<ChannelName>
}

/**
 * Client Registry
 * Manages the lifecycle of connected clients
 */
export class ClientRegistry {
  private clients: Map<string, ClientData> = new Map()
  private channelSubscribers: Map<ChannelName, Set<string>> = new Map()

  /**
   * Register a new client
   */
  register(
    clientId: string,
    transport: ServerTransport,
    connection: ClientConnection,
  ): ServerClient {
    const clientData: ClientData = {
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
   */
  unregister(clientId: string): boolean {
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
   */
  get(clientId: string): ServerClient | undefined {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return undefined
    }

    const connection = clientData.transport.getClient(clientId)
    if (!connection) {
      return undefined
    }

    return this.createServerClient(clientData, connection)
  }

  /**
   * Get all clients
   */
  getAll(): ServerClient[] {
    const clients: ServerClient[] = []
    for (const [clientId, clientData] of this.clients) {
      const connection = clientData.transport.getClient(clientId)
      if (connection) {
        clients.push(this.createServerClient(clientData, connection))
      }
    }
    return clients
  }

  /**
   * Get client count
   */
  getCount(): number {
    return this.clients.size
  }

  /**
   * Subscribe a client to a channel
   */
  subscribe(clientId: string, channel: ChannelName): boolean {
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
   */
  unsubscribe(clientId: string, channel: ChannelName): boolean {
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
   */
  getSubscribers(channel: ChannelName): ServerClient[] {
    const subscriberIds = this.channelSubscribers.get(channel)
    if (!subscriberIds) {
      return []
    }

    const clients: ServerClient[] = []
    for (const clientId of subscriberIds) {
      const clientData = this.clients.get(clientId)
      if (clientData) {
        const connection = clientData.transport.getClient(clientId)
        if (connection) {
          clients.push(this.createServerClient(clientData, connection))
        }
      }
    }
    return clients
  }

  /**
   * Get subscriber count for a channel
   */
  getSubscriberCount(channel: ChannelName): number {
    return this.channelSubscribers.get(channel)?.size ?? 0
  }

  /**
   * Get all channels that have subscribers
   */
  getChannels(): ChannelName[] {
    return Array.from(this.channelSubscribers.keys())
  }

  /**
   * Get total number of subscriptions across all channels
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
   */
  isSubscribed(clientId: string, channel: ChannelName): boolean {
    const clientData = this.clients.get(clientId)
    if (!clientData) {
      return false
    }
    return clientData.subscriptions.has(channel)
  }

  /**
   * Clear all clients
   */
  clear(): void {
    this.clients.clear()
    this.channelSubscribers.clear()
  }

  /**
   * Create a ServerClient wrapper from internal data
   */
  private createServerClient(
    clientData: ClientData,
    connection: ClientConnection,
  ): ServerClient {
    const self = this

    return {
      // Include all properties from ClientConnection
      id: connection.id,
      connectedAt: connection.connectedAt,
      lastPingAt: connection.lastPingAt,
      // Add server-specific methods
      send: async (message: Message) => {
        await clientData.transport.sendToClient(clientData.id, message)
      },
      disconnect: async (code?: number, reason?: string) => {
        const conn = clientData.transport.getClient(clientData.id)
        if (conn && conn.socket) {
          conn.socket.close(code ?? 1000, reason ?? 'Disconnected')
        }
      },
      getSubscriptions: () => {
        return Array.from(clientData.subscriptions)
      },
      hasSubscription: (channel: ChannelName) => {
        return clientData.subscriptions.has(channel)
      },
      socket: connection.socket,
    }
  }
}
