/**
 * Base Types
 * Foundational interfaces that serve as the single source of truth for all server types.
 *
 * All related types should extend these base interfaces to maintain consistency.
 * This is the foundation layer - everything builds on top of these.
 */

import type WebSocket from 'ws'
import type { ClientId, Timestamp, ChannelName } from '@synnel/types'

// ============================================================
// BASE CLIENT CONNECTION
// ============================================================

/**
 * Base client connection interface
 * Single source of truth for all client-related types.
 *
 * All client types (IServerClient, IClientData, etc.) should extend
 * this interface to ensure consistency across the codebase.
 *
 * @example
 * ```ts
 * // Extending for server client
 * interface IServerClient extends IClientConnection {
 *   send(message: Message): Promise<void>
 *   disconnect(): Promise<void>
 * }
 *
 * // Extending for custom metadata
 * type IClientWithMetadata<T> = IClientConnection & T
 * ```
 */
export interface IClientConnection {
  /** Unique client identifier */
  readonly id: ClientId

  /** Connected timestamp (Unix timestamp in milliseconds) */
  readonly connectedAt: Timestamp

  /** Last ping timestamp (undefined if never pinged) */
  readonly lastPingAt?: Timestamp

  /** Raw WebSocket instance for this connection */
  readonly socket: WebSocket
}

// ============================================================
// BASE CHANNEL
// ============================================================

/**
 * Base channel interface
 * Single source of truth for all channel types.
 *
 * All channel types (IChannelTransport, IBroadcastTransport, IMulticastTransport)
 * should extend this interface to ensure consistent channel API.
 *
 * @template T The type of data published on this channel
 *
 * @example
 * ```ts
 * // Extending for message handling
 * interface IChannelTransport<T> extends IChannel<T> {
 *   onMessage(handler: IMessageHandler<T>): () => void
 * }
 *
 * // Extending for broadcast
 * interface IBroadcastTransport<T> extends IChannel<T> {
 *   publish(data: T): void
 *   publishExcept(data: T, exclude: ClientId): void
 * }
 * ```
 */
export interface IChannel<T> {
  /** Channel name */
  readonly name: ChannelName

  /** Number of active subscribers */
  readonly subscriberCount: number

  /**
   * Publish data to all subscribers
   *
   * @param data - The data to publish
   * @param excludeClientId - Optional client ID to exclude from receiving the message
   */
  publish(data: T, excludeClientId?: ClientId): void

  /**
   * Publish data to a specific client in the channel
   *
   * @param clientId - The client ID to publish to
   * @param data - The data to publish
   */
  publishTo(clientId: ClientId, data: T): void
}

// ============================================================
// BASE MESSAGE HANDLER
// ============================================================

/**
 * Base message handler signature
 * Single source of truth for all message handler types.
 *
 * @template T The type of data the handler receives
 *
 * @example
 * ```ts
 * // Channel message handler
 * const handler: IMessageHandler<string> = async (data, client, message) => {
 *   console.log(`Received from ${client.id}:`, data)
 * }
 *
 * // Broadcast handler
 * const broadcastHandler: IMessageHandler<unknown> = (data, client) => {
 *   console.log(`Broadcast from ${client.id}:`, data)
 * }
 * ```
 */
export type IMessageHandler<T> = (
  data: T,
  client: IClientConnection,
  message: import('@synnel/types').DataMessage<T>,
) => void | Promise<void>

// ============================================================
// BASE LIFECYCLE HANDLER
// ============================================================

/**
 * Base lifecycle handler signature
 * Used for subscribe/unsubscribe events.
 *
 * @example
 * ```ts
 * const onSubscribe: ILifecycleHandler = async (client) => {
 *   console.log(`Client ${client.id} subscribed`)
 *   await sendWelcomeMessage(client)
 * }
 *
 * const onUnsubscribe: ILifecycleHandler = (client) => {
 *   console.log(`Client ${client.id} left`)
 * }
 * ```
 */
export type ILifecycleHandler = (
  client: IClientConnection,
) => void | Promise<void>

// ============================================================
// BASE TRANSPORT
// ============================================================

/**
 * Base transport interface
 * Single source of truth for all transport implementations.
 *
 * Transports are responsible for low-level WebSocket communication.
 * They manage connections and handle message passing.
 *
 * All transport implementations must extend or implement this interface.
 */
export interface IBaseTransport {
  /** Map of all connected clients by ID */
  readonly connections: Map<ClientId, IClientConnection>

  /**
   * Send a message to a specific client
   *
   * @param clientId - The target client ID
   * @param message - The message to send
   * @throws Error if client not found or not connected
   */
  sendToClient(
    clientId: ClientId,
    message: import('@synnel/types').Message,
  ): Promise<void>

  /**
   * Get all connected clients
   *
   * @returns Array of all client connections
   */
  getClients(): IClientConnection[]

  /**
   * Get a specific client by ID
   *
   * @param clientId - The client ID to look up
   * @returns The client connection or undefined if not found
   */
  getClient(clientId: ClientId): IClientConnection | undefined
}
