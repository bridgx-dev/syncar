/**
 * Client Types
 * Types for client management and server-side client representation.
 */

import type { IClientConnection, IChannel } from './base'
import type { ChannelName, ClientId } from './common'

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
   * @returns The registered connection
   */
  register(connection: IClientConnection): IClientConnection

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
   * @returns The connection or undefined if not found
   */
  get(clientId: ClientId): IClientConnection | undefined

  /**
   * Get all registered clients
   *
   * @returns Array of all connections
   */
  getAll(): IClientConnection[]

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
  registerChannel(channel: IChannel<unknown>): void

  /**
   * Get a channel instance by name
   *
   * @param name - Channel name
   * @returns Channel instance or undefined if not found
   */
  getChannel<T = unknown>(name: ChannelName): IChannel<T> | undefined

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
   * @returns Array of subscribed connections
   */
  getSubscribers(channel: ChannelName): IClientConnection[]

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
   * Get all channels a client is subscribed to
   *
   * @param clientId - Client ID
   * @returns Set of channel names
   */
  getClientChannels(clientId: ClientId): Set<ChannelName>

  /**
   * Get subscriber IDs for a channel
   *
   * @param channel - Channel name
   * @returns Set of subscriber IDs
   */
  getChannelSubscribers(channel: ChannelName): Set<ClientId>

  /**
   * Clear all clients and subscriptions
   */
  clear(): void
}

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

// ============================================================
// CLIENT REGISTRY CLASS
// ============================================================

/**
 * Client Registry - manages connected clients and their subscriptions
 *
 * @remarks
 * Uses bidirectional index for efficient lookups:
 * - subscriptions: ClientId → Channels (for disconnect cleanup)
 * - channels: ChannelName → Subscribers (for broadcasting)
 *
 * @example
 * ```ts
 * const registry = new ClientRegistry()
 *
 * // Register client
 * const client = registry.register(connection)
 *
 * // Subscribe to channel
 * registry.subscribe(client.id, 'chat')
 *
 * // Get subscribers
 * const subscribers = registry.getSubscribers('chat')
 * ```
 */
export declare class ClientRegistry implements IClientRegistry {
  /**
   * Shared map of all connected clients by ID
   */
  readonly connections: Map<ClientId, IClientConnection>

  // ============================================================
  // CLIENT REGISTRATION
  // ============================================================

  /**
   * Register a new client
   *
   * @param connection - The connection object
   * @returns The registered connection
   */
  register(connection: IClientConnection): IClientConnection

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
   * @returns The connection or undefined if not found
   */
  get(clientId: ClientId): IClientConnection | undefined

  /**
   * Get all registered clients
   *
   * @returns Array of all connections
   */
  getAll(): IClientConnection[]

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
  registerChannel(channel: IChannel<unknown>): void

  /**
   * Get a channel instance by name
   *
   * @param name - Channel name
   * @returns Channel instance or undefined if not found
   */
  getChannel<T = unknown>(name: ChannelName): IChannel<T> | undefined

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
   * @returns Array of subscribed connections
   */
  getSubscribers(channel: ChannelName): IClientConnection[]

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
   * Get all channels a client is subscribed to
   *
   * @param clientId - Client ID
   * @returns Set of channel names
   */
  getClientChannels(clientId: ClientId): Set<ChannelName>

  /**
   * Get subscriber IDs for a channel
   *
   * @param channel - Channel name
   * @returns Set of subscriber IDs
   */
  getChannelSubscribers(channel: ChannelName): Set<ClientId>

  /**
   * Clear all clients and subscriptions
   */
  clear(): void
}
