/**
 * Handler Registry Types
 * Types for managing channel event handlers separately from data storage.
 */

import type { IMessageHandler, ILifecycleHandler } from './base'
import type { ChannelName } from './common'

/**
 * Handler registry state
 */
export interface HandlerRegistryState {
  messageHandlers: Map<ChannelName, Set<IMessageHandler<unknown>>>
  subscribeHandlers: Map<ChannelName, Set<ILifecycleHandler>>
  unsubscribeHandlers: Map<ChannelName, Set<ILifecycleHandler>>
}

/**
 * Handler Registry - manages channel event handlers
 *
 * @remarks
 * Handlers are stored separately from channel data for better organization
 * and to enable centralized handler management.
 *
 * @example
 * ```ts
 * const registry = new HandlerRegistry()
 *
 * // Add message handler
 * const unsubscribe = registry.addMessageHandler('chat', async (data, client) => {
 *   console.log(`Received from ${client.id}:`, data)
 * })
 *
 * // Later: unsubscribe()
 * ```
 */
export declare class HandlerRegistry {
  private readonly state

  // ============================================================
  // MESSAGE HANDLERS
  // ============================================================

  /**
   * Add a message handler for a channel
   *
   * @param channel - Channel name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  addMessageHandler<T = unknown>(
    channel: ChannelName,
    handler: IMessageHandler<T>,
  ): () => void

  /**
   * Remove a message handler from a channel
   *
   * @param channel - Channel name
   * @param handler - Handler function to remove
   */
  removeMessageHandler<T = unknown>(
    channel: ChannelName,
    handler: IMessageHandler<T>,
  ): void

  /**
   * Get all message handlers for a channel
   *
   * @param channel - Channel name
   * @returns Set of handlers (empty if none)
   */
  getMessageHandlers(channel: ChannelName): Set<IMessageHandler<unknown>>

  // ============================================================
  // SUBSCRIBE HANDLERS
  // ============================================================

  /**
   * Add a subscribe handler for a channel
   *
   * @param channel - Channel name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  addSubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): () => void

  /**
   * Remove a subscribe handler from a channel
   *
   * @param channel - Channel name
   * @param handler - Handler function to remove
   */
  removeSubscribeHandler(channel: ChannelName, handler: ILifecycleHandler): void

  /**
   * Get all subscribe handlers for a channel
   *
   * @param channel - Channel name
   * @returns Set of handlers (empty if none)
   */
  getSubscribeHandlers(channel: ChannelName): Set<ILifecycleHandler>

  // ============================================================
  // UNSUBSCRIBE HANDLERS
  // ============================================================

  /**
   * Add an unsubscribe handler for a channel
   *
   * @param channel - Channel name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  addUnsubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): () => void

  /**
   * Remove an unsubscribe handler from a channel
   *
   * @param channel - Channel name
   * @param handler - Handler function to remove
   */
  removeUnsubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): void

  /**
   * Get all unsubscribe handlers for a channel
   *
   * @param channel - Channel name
   * @returns Set of handlers (empty if none)
   */
  getUnsubscribeHandlers(channel: ChannelName): Set<ILifecycleHandler>

  // ============================================================
  // CLEANUP METHODS
  // ============================================================

  /**
   * Clear all handlers for a specific channel
   *
   * @param channel - Channel name
   */
  clearChannel(channel: ChannelName): void

  /**
   * Clear all handlers
   */
  clear(): void

  /**
   * Get the number of message handlers across all channels
   *
   * @returns Total handler count
   */
  getHandlerCount(): number

  /**
   * Get all channel names that have at least one handler
   *
   * @returns Array of channel names
   */
  getActiveChannels(): ChannelName[]
}
