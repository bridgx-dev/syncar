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
 * All client types should extend
 * this interface to ensure consistency across the codebase.
 *
 * @example
 * ```ts
 * // Standard usage
 * const client: IClientConnection = ...
 * ```
 */
export interface IClientConnection {
  /** Unique client identifier */
  readonly id: ClientId

  /** Connected timestamp (Unix timestamp in milliseconds) */
  readonly connectedAt: Timestamp

  /** Last ping timestamp (undefined if never pinged) */
  lastPingAt?: Timestamp

  /** Raw WebSocket instance for this connection */
  readonly socket: WebSocket
}

// ============================================================
// BASE CHANNEL
// ============================================================

/**
 * Publish options for channel messages
 *
 * @example
 * ```ts
 * // Send to all subscribers
 * channel.publish('Hello everyone!')
 *
 * // Send to specific clients
 * channel.publish('Private message', { to: ['client-1', 'client-2'] })
 *
 * // Send to all except specific clients
 * channel.publish('Hello everyone except...', { exclude: ['client-3'] })
 *
 * // Send to specific clients, excluding some from that list
 * channel.publish('Group message', {
 *   to: ['client-1', 'client-2', 'client-3'],
 *   exclude: ['client-2']
 * }) // Only sends to client-1 and client-3
 * ```
 */
export interface IPublishOptions {
  /**
   * Specific client IDs to receive the message
   * If provided, only these clients will receive the message
   * Use with `exclude` to filter from this list
   */
  to?: readonly ClientId[]

  /**
   * Client IDs to exclude from receiving the message
   * When `to` is provided: excludes from the `to` list
   * When `to` is not provided: excludes from all subscribers
   */
  exclude?: readonly ClientId[]
}

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
 *   // Inherits publish method from IChannel
 * }
 * ```
 */
export interface IChannel<T> {
  /** Channel name */
  readonly name: ChannelName

  /** Number of active subscribers */
  readonly subscriberCount: number

  /**
   * Publish data to channel subscribers with fine-grained control
   *
   * @param data - The data to publish
   * @param options - Optional publish options
   *
   * @example
   * ```ts
   * // Send to all subscribers
   * channel.publish('Hello everyone!')
   *
   * // Send to specific clients
   * channel.publish('Private message', { to: ['client-1', 'client-2'] })
   *
   * // Send to all except specific clients
   * channel.publish('Hello', { exclude: ['client-3'] })
   *
   * // Combine to and exclude
   * channel.publish('Message', {
   *   to: ['client-1', 'client-2', 'client-3'],
   *   exclude: ['client-2']
   * }) // Only sends to client-1 and client-3
   * ```
   */
  publish(data: T, options?: IPublishOptions): void
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
