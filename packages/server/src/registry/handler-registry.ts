/**
 * Handler Registry
 * Manages channel handlers separately from data storage.
 */

import type { IMessageHandler, ILifecycleHandler } from '../types'
import type { ChannelName } from '../types'

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
 * Handlers are stored separately from channel data for better organization
 * and to enable centralized handler management.
 */
export class HandlerRegistry {
  private readonly state: HandlerRegistryState = {
    messageHandlers: new Map(),
    subscribeHandlers: new Map(),
    unsubscribeHandlers: new Map(),
  }

  // ============================================================
  // MESSAGE HANDLERS
  // ============================================================

  /**
   * Add a message handler for a channel
   * @param channel - Channel name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  addMessageHandler<T = unknown>(
    channel: ChannelName,
    handler: IMessageHandler<T>,
  ): () => void {
    if (!this.state.messageHandlers.has(channel)) {
      this.state.messageHandlers.set(channel, new Set())
    }
    this.state.messageHandlers.get(channel)!.add(handler as IMessageHandler<unknown>)
    return () => this.removeMessageHandler(channel, handler)
  }

  /**
   * Remove a message handler from a channel
   * @param channel - Channel name
   * @param handler - Handler function to remove
   */
  removeMessageHandler<T = unknown>(
    channel: ChannelName,
    handler: IMessageHandler<T>,
  ): void {
    this.state.messageHandlers.get(channel)?.delete(handler as IMessageHandler<unknown>)
  }

  /**
   * Get all message handlers for a channel
   * @param channel - Channel name
   * @returns Set of handlers (empty if none)
   */
  getMessageHandlers(channel: ChannelName): Set<IMessageHandler<unknown>> {
    return this.state.messageHandlers.get(channel) ?? new Set()
  }

  // ============================================================
  // SUBSCRIBE HANDLERS
  // ============================================================

  /**
   * Add a subscribe handler for a channel
   * @param channel - Channel name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  addSubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): () => void {
    if (!this.state.subscribeHandlers.has(channel)) {
      this.state.subscribeHandlers.set(channel, new Set())
    }
    this.state.subscribeHandlers.get(channel)!.add(handler)
    return () => this.removeSubscribeHandler(channel, handler)
  }

  /**
   * Remove a subscribe handler from a channel
   * @param channel - Channel name
   * @param handler - Handler function to remove
   */
  removeSubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): void {
    this.state.subscribeHandlers.get(channel)?.delete(handler)
  }

  /**
   * Get all subscribe handlers for a channel
   * @param channel - Channel name
   * @returns Set of handlers (empty if none)
   */
  getSubscribeHandlers(channel: ChannelName): Set<ILifecycleHandler> {
    return this.state.subscribeHandlers.get(channel) ?? new Set()
  }

  // ============================================================
  // UNSUBSCRIBE HANDLERS
  // ============================================================

  /**
   * Add an unsubscribe handler for a channel
   * @param channel - Channel name
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  addUnsubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): () => void {
    if (!this.state.unsubscribeHandlers.has(channel)) {
      this.state.unsubscribeHandlers.set(channel, new Set())
    }
    this.state.unsubscribeHandlers.get(channel)!.add(handler)
    return () => this.removeUnsubscribeHandler(channel, handler)
  }

  /**
   * Remove an unsubscribe handler from a channel
   * @param channel - Channel name
   * @param handler - Handler function to remove
   */
  removeUnsubscribeHandler(
    channel: ChannelName,
    handler: ILifecycleHandler,
  ): void {
    this.state.unsubscribeHandlers.get(channel)?.delete(handler)
  }

  /**
   * Get all unsubscribe handlers for a channel
   * @param channel - Channel name
   * @returns Set of handlers (empty if none)
   */
  getUnsubscribeHandlers(channel: ChannelName): Set<ILifecycleHandler> {
    return this.state.unsubscribeHandlers.get(channel) ?? new Set()
  }

  // ============================================================
  // CLEANUP METHODS
  // ============================================================

  /**
   * Clear all handlers for a specific channel
   * @param channel - Channel name
   */
  clearChannel(channel: ChannelName): void {
    this.state.messageHandlers.delete(channel)
    this.state.subscribeHandlers.delete(channel)
    this.state.unsubscribeHandlers.delete(channel)
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.state.messageHandlers.clear()
    this.state.subscribeHandlers.clear()
    this.state.unsubscribeHandlers.clear()
  }

  /**
   * Get the number of message handlers across all channels
   * @returns Total handler count
   */
  getHandlerCount(): number {
    let count = 0
    for (const handlers of this.state.messageHandlers.values()) {
      count += handlers.size
    }
    return count
  }

  /**
   * Get all channel names that have at least one handler
   * @returns Array of channel names
   */
  getActiveChannels(): ChannelName[] {
    const channels = new Set<ChannelName>()

    for (const [channel, handlers] of this.state.messageHandlers) {
      if (handlers.size > 0) channels.add(channel)
    }
    for (const [channel, handlers] of this.state.subscribeHandlers) {
      if (handlers.size > 0) channels.add(channel)
    }
    for (const [channel, handlers] of this.state.unsubscribeHandlers) {
      if (handlers.size > 0) channels.add(channel)
    }

    return Array.from(channels)
  }
}
