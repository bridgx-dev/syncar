/**
 * Event Emitter
 * Type-safe event emitter for the Synnel server.
 *
 * @module emitter/event-emitter
 */

import type {
  IEventEmitter,
  IEventUnsubscriber,
} from '../types/index.js'

// ============================================================
// EVENT EMITTER CLASS
// ============================================================

/**
 * Type-safe event emitter
 * Provides strongly-typed event registration and emission.
 *
 * @template E Event map type mapping event names to handler signatures
 *
 * @example
 * ```ts
 * import { EventEmitter } from '@synnel/server/emitter'
 *
 * // Define event map
 * interface MyEvents {
 *   connection: (client: ServerClient) => void
 *   message: (client: ServerClient, data: string) => void
 *   error: (error: Error) => void
 * }
 *
 * const emitter = new EventEmitter<MyEvents>()
 *
 * // Register handler (type-safe)
 * const unsubscribe = emitter.on('connection', (client) => {
 *   console.log('Client connected:', client.id)
 * })
 *
 * // One-time handler
 * emitter.once('message', (client, data) => {
 *   console.log('Got message:', data)
 *   // Handler auto-removed after first call
 * })
 *
 * // Emit event
 * emitter.emit('connection', client)
 *
 * // Remove specific handler
 * const handler = (client) => console.log('Connected', client.id)
 * emitter.on('connection', handler)
 * emitter.off('connection', handler)
 *
 * // Remove all handlers for an event
 * emitter.removeAllListeners('connection')
 * ```
 */
export class EventEmitter<E extends Record<string, any>> implements IEventEmitter<E> {
  /**
   * Storage for event listeners
   * Maps event names to Sets of handler functions
   *
   * @example
   * ```ts
   * listeners = Map<keyof E, Set<any>>
   * // For IServerEventMap:
   * // Map<'connection' | 'disconnection' | ..., Set<Function>>
   * ```
   */
  protected readonly listeners: Map<keyof E, Set<any>> = new Map()

  /**
   * Storage for one-time listener tracking
   * Used to auto-remove one-time handlers after first invocation
   */
  protected readonly onceListeners: WeakMap<
    (...args: any[]) => void,
    { event: keyof E; originalHandler: (...args: any[]) => void }
  > = new WeakMap()

  /**
   * Register an event handler
   *
   * @template K Event key type
   * @param event - The event to listen for
   * @param handler - The event handler function
   * @returns Unsubscribe function that removes this handler
   *
   * @example
   * ```ts
   * const unsubscribe = emitter.on('connection', (client) => {
   *   console.log('Connected:', client.id)
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  on<K extends keyof E>(
    event: K,
    handler: E[K],
  ): IEventUnsubscriber {
    // Get or create handler set for this event
    let handlers = this.listeners.get(event)
    if (!handlers) {
      handlers = new Set<any>()
      this.listeners.set(event, handlers)
    }

    // Add handler
    handlers.add(handler)

    // Return unsubscribe function
    return () => {
      this.off(event, handler)
    }
  }

  /**
   * Register a one-time event handler
   * The handler is automatically removed after first invocation.
   *
   * @template K Event key type
   * @param event - The event to listen for
   * @param handler - The event handler function
   * @returns Unsubscribe function
   *
   * @example
   * ```ts
   * emitter.once('connection', (client) => {
   *   console.log('First connection only:', client.id)
   *   // Handler is auto-removed after this call
   * })
   * ```
   */
  once<K extends keyof E>(event: K, handler: E[K]): IEventUnsubscriber {
    // Create wrapper that removes itself after first call
    const wrapper = (...args: any[]) => {
      // Remove from listeners before calling
      const handlers = this.listeners.get(event)
      if (handlers) {
        handlers.delete(wrapper)
      }

      // Remove from once tracking
      this.onceListeners.delete(wrapper)

      // Call original handler
      ;(handler as any)(...args)
    }

    // Track the original handler for removal via off()
    this.onceListeners.set(wrapper, { event, originalHandler: handler as any })

    // Register wrapper
    let handlers = this.listeners.get(event)
    if (!handlers) {
      handlers = new Set<any>()
      this.listeners.set(event, handlers)
    }
    handlers.add(wrapper)

    // Return unsubscribe function
    return () => {
      this.off(event, wrapper as any)
    }
  }

  /**
   * Remove a specific event handler
   *
   * @template K Event key type
   * @param event - The event
   * @param handler - The handler to remove
   *
   * @example
   * ```ts
   * const handler = (client) => console.log('Connected', client.id)
   * emitter.on('connection', handler)
   * // Later:
   * emitter.off('connection', handler)
   * ```
   */
  off<K extends keyof E>(event: K, handler: E[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) {
      return
    }

    // Check if this is a once() wrapper
    const onceInfo = this.onceListeners.get(handler as any)
    if (onceInfo) {
      handlers.delete(handler as any)
      this.onceListeners.delete(handler as any)
      return
    }

    // For once handlers, find and remove the wrapper that wraps this handler
    for (const h of Array.from(handlers)) {
      const info = this.onceListeners.get(h)
      if (info && info.event === event && info.originalHandler === handler) {
        handlers.delete(h)
        this.onceListeners.delete(h)
        return
      }
    }

    // Regular handler removal
    handlers.delete(handler)
  }

  /**
   * Emit an event to all registered handlers
   *
   * Handlers are called in the order they were registered.
   * If a handler throws an error, it is logged but other handlers still execute.
   *
   * @template K Event key type
   * @param event - The event to emit
   * @param args - Arguments to pass to handlers
   *
   * @example
   * ```ts
   * emitter.emit('connection', client)
   * emitter.emit('message', client, 'Hello')
   * ```
   */
  emit<K extends keyof E>(
    event: K,
    ...args: E[K] extends (...args: infer P) => any ? P : never
  ): void {
    const handlers = this.listeners.get(event)
    if (!handlers || handlers.size === 0) {
      return
    }

    // Call each handler
    // Clone the set to avoid issues if handlers modify the set during iteration
    for (const handler of Array.from(handlers)) {
      try {
        ;(handler as any)(...args)
      } catch (error) {
        // Log error but continue with other handlers
        console.error(`Error in ${String(event)} handler:`, error)
      }
    }
  }

  /**
   * Remove all handlers for a specific event
   *
   * @template K Event key type
   * @param event - The event to clear
   *
   * @example
   * ```ts
   * emitter.removeAllListeners('connection')
   * ```
   */
  removeAllListeners<K extends keyof E>(event?: K): void {
    if (event === undefined) {
      // Clear all events
      this.listeners.clear()
      return
    }

    // Clear specific event
    const handlers = this.listeners.get(event)
    if (handlers) {
      // Clean up once tracking for removed handlers
      for (const handler of Array.from(handlers)) {
        this.onceListeners.delete(handler)
      }
    }
    this.listeners.delete(event)
  }

  /**
   * Get the number of listeners for an event
   *
   * @template K Event key type
   * @param event - The event to check
   * @returns Number of registered listeners
   *
   * @example
   * ```ts
   * console.log(emitter.listenerCount('connection')) // 3
   * ```
   */
  listenerCount<K extends keyof E>(event: K): number {
    const handlers = this.listeners.get(event)
    return handlers ? handlers.size : 0
  }

  /**
   * Get all event names that have listeners
   *
   * @returns Array of event names with registered listeners
   *
   * @example
   * ```ts
   * console.log(emitter.eventNames()) // ['connection', 'message']
   * ```
   */
  eventNames(): Array<keyof E> {
    return Array.from(this.listeners.keys())
  }

  /**
   * Check if there are any listeners for an event
   *
   * @template K Event key type
   * @param event - The event to check
   * @returns true if event has listeners, false otherwise
   *
   * @example
   * ```ts
   * if (emitter.hasListeners('connection')) {
   *   console.log('Waiting for connections...')
   * }
   * ```
   */
  hasListeners<K extends keyof E>(event: K): boolean {
    const handlers = this.listeners.get(event)
    return handlers ? handlers.size > 0 : false
  }

  /**
   * Get the raw listeners Map for advanced use cases
   *
   * @returns The internal listeners storage
   *
   * @example
   * ```ts
   * const allListeners = emitter.rawListeners
   * for (const [event, handlers] of allListeners) {
   *   console.log(`${String(event)}: ${handlers.size} listeners`)
   * }
   * ```
   */
  get rawListeners(): Map<keyof E, Set<any>> {
    return this.listeners
  }
}
