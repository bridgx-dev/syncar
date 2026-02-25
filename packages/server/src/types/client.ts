/**
 * Client Types
 * Types for client management and server-side client representation.
 */

import type { IClientConnection } from './base.js'
import type { IServerTransport } from './transport.js'
import type { IChannelTransport } from './channel.js'
import type { ChannelName, ClientId, Message, MergeTypes } from '@synnel/types'

// ============================================================
// CLIENT DATA (INTERNAL)
// ============================================================

/**
 * Internal client data structure - alias for IClientConnection
 * Used by ClientRegistry to track client connections.
 */
export type IClientData = IClientConnection

// ============================================================
// SERVER CLIENT INTERFACE
// ============================================================
// ... (IServerClient stays same for now) ...
export interface IServerClient extends IClientConnection {
  /**
   * Send a message to this client
   *
   * @param message - The message to send
   * @throws Error if client is not connected
   */
  send(message: Message): Promise<void>

  /**
   * Disconnect this client
   *
   * @param code - WebSocket close code (default: 1000)
   * @param reason - Close reason string
   */
  disconnect(code?: number, reason?: string): Promise<void>

  /**
   * Get all channels this client is subscribed to
   *
   * @returns Array of channel names
   */
  getSubscriptions(): ChannelName[]

  /**
   * Check if client is subscribed to a specific channel
   *
   * @param channel - The channel name to check
   * @returns true if subscribed, false otherwise
   */
  hasSubscription(channel: ChannelName): boolean
}

// ============================================================
// CLIENT REGISTRY INTERFACE
// ============================================================

/**
 * Client registry interface
 * Manages the lifecycle and subscriptions of connected clients.
 *
 * Implementations must track client connections, handle subscription
 * management, and provide lookup capabilities.
 *
 * @example
 * ```ts
 * // Type usage
 * const registry: IClientRegistry = ...
 *
 * // Register a new client
 * const client = registry.register(connection, transport)
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
export interface IClientRegistry {
  /**
   * Shared map of all connected clients by ID
   * This property is shared with the transport layer for memory efficiency.
   */
  readonly connections: Map<ClientId, IClientConnection>

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
  ): IServerClient

  /**
   * Unregister a client
   *
   * @param clientId - Client to unregister
   * @returns true if client was found and removed, false otherwise
   */
  unregister(clientId: ClientId): boolean

  /**
   * Get a client by ID
   *
   * @param clientId - Client ID to look up
   * @returns Server client or undefined if not found
   */
  get(clientId: ClientId): IServerClient | undefined

  /**
   * Get all registered clients
   *
   * @returns Array of all server clients
   */
  getAll(): IServerClient[]

  /**
   * Get the number of registered clients
   *
   * @returns Client count
   */
  getCount(): number

  // ============================================================
  // CHANNEL MANAGEMENT
  // ============================================================

  /**
   * Register a channel instance
   *
   * @param channel - Channel instance to register
   */
  registerChannel(channel: IChannelTransport<unknown>): void

  /**
   * Get a channel instance by name
   *
   * @param name - Channel name
   * @returns Channel instance or undefined if not found
   */
  getChannel<T = unknown>(name: ChannelName): IChannelTransport<T> | undefined

  /**
   * Remove a channel instance
   *
   * @param name - Channel name to remove
   * @returns true if channel was found and removed, false otherwise
   */
  removeChannel(name: ChannelName): boolean

  /**
   * Subscribe a client to a channel
   *
   * @param clientId - Client to subscribe
   * @param channel - Channel to subscribe to
   * @returns true if subscription succeeded, false otherwise
   */
  subscribe(clientId: ClientId, channel: ChannelName): boolean

  /**
   * Unsubscribe a client from a channel
   *
   * @param clientId - Client to unsubscribe
   * @param channel - Channel to unsubscribe from
   * @returns true if unsubscription succeeded, false otherwise
   */
  unsubscribe(clientId: ClientId, channel: ChannelName): boolean

  /**
   * Get all subscribers for a channel
   *
   * @param channel - Channel name
   * @returns Array of subscribed clients
   */
  getSubscribers(channel: ChannelName): IServerClient[]

  /**
   * Get subscriber count for a channel
   *
   * @param channel - Channel name
   * @returns Number of subscribers
   */
  getSubscriberCount(channel: ChannelName): number

  /**
   * Get all active channel names
   *
   * @returns Array of channel names
   */
  getChannels(): ChannelName[]

  /**
   * Get total subscription count across all channels
   *
   * @returns Total number of subscriptions
   */
  getTotalSubscriptionCount(): number

  /**
   * Check if a client is subscribed to a channel
   *
   * @param clientId - Client ID to check
   * @param channel - Channel to check
   * @returns true if subscribed, false otherwise
   */
  isSubscribed(clientId: ClientId, channel: ChannelName): boolean

  /**
   * Clear all clients and subscriptions
   */
  clear(): void
}

// ============================================================
// CLIENT EXTENSION UTILITIES
// ============================================================

/**
 * Extend IServerClient with custom metadata
 *
 * @template T Custom metadata type
 *
 * @example
 * ```ts
 * interface UserMetadata {
 *   userId: string
 *   email: string
 *   role: 'admin' | 'user'
 * }
 *
 * type AuthenticatedClient = IClientWithMetadata<UserMetadata>
 *
 * function handleClient(client: AuthenticatedClient) {
 *   console.log(client.userId, client.email)  // Type-safe!
 *   await client.send({ type: 'data', data: 'Hello' })  // Inherited methods work
 * }
 * ```
 */
export type IClientWithMetadata<T extends object> = MergeTypes<IServerClient, T>

// ============================================================
// DISCONNECTION EVENT
// ============================================================

/**
 * Disconnection event data
 * Emitted when a client disconnects from the server.
 *
 * @example
 * ```ts
 * server.on('disconnection', (client) => {
 *   const event: IDisconnectionEvent = {
 *     clientId: client.id,
 *     code: 1000,
 *     reason: 'Normal closure'
 *   }
 *   logDisconnection(event)
 * })
 * ```
 */
export interface IDisconnectionEvent {
  /** Client ID that disconnected */
  clientId: ClientId

  /** WebSocket close code (if available) */
  code?: number

  /** Close reason string (if available) */
  reason?: string
}
