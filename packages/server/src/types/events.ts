/**
 * Event System Types
 * Types for the server event system including event types, handlers, and emission.
 */

import type { IClientConnection } from './base'
import type { ChannelName } from './common'
import type { Message } from './message'

// ============================================================
// SERVER EVENT TYPES
// ============================================================

/**
 * Server event types
 * All events that can be emitted by the server.
 *
 * @example
 * ```ts
 * server.on('connection', (client) => {
 *   console.log(`Client ${client.id} connected`)
 * })
 *
 * server.on('message', (client, message) => {
 *   console.log(`Message from ${client.id}:`, message)
 * })
 *
 * server.on('subscribe', (client, channel) => {
 *   console.log(`${client.id} joined ${channel}`)
 * })
 * ```
 */
export type IServerEventType =
  | 'connection' // New client connected
  | 'disconnection' // Client disconnected
  | 'message' // Message received from client
  | 'subscribe' // Client subscribed to channel
  | 'unsubscribe' // Client unsubscribed from channel
  | 'error' // Server error occurred

// ============================================================
// SERVER EVENT MAP
// ============================================================

/**
 * Server event map
 * Maps event types to their handler signatures.
 *
 * @example
 * ```ts
 * type ConnectionHandler = IServerEventMap['connection']
 * // (client: IClientConnection) => void
 *
 * type MessageHandler = IServerEventMap['message']
 * // (client: IClientConnection, message: Message) => void
 *
 * function on<E extends IServerEventType>(
 *   event: E,
 *   handler: IServerEventMap[E]
 * ) {
 *   // Type-safe event registration
 * }
 * ```
 */
export interface IServerEventMap {
  /**
   * Fired when a new client connects
   *
   * @param client - The connected client
   */
  connection: (client: IClientConnection) => void

  /**
   * Fired when a client disconnects
   *
   * @param client - The disconnected client
   */
  disconnection: (client: IClientConnection) => void

  /**
   * Fired when a message is received from a client
   *
   * @param client - The client who sent the message
   * @param message - The received message
   */
  message: (client: IClientConnection, message: Message) => void

  /**
   * Fired when a client subscribes to a channel
   *
   * @param client - The client
   * @param channel - The channel name
   */
  subscribe: (client: IClientConnection, channel: ChannelName) => void

  /**
   * Fired when a client unsubscribes from a channel
   *
   * @param client - The client
   * @param channel - The channel name
   */
  unsubscribe: (client: IClientConnection, channel: ChannelName) => void

  /**
   * Fired when an error occurs
   *
   * @param error - The error
   */
  error: (error: Error) => void
}

// ============================================================
// EVENT HANDLER TYPE
// ============================================================

/**
 * Event handler type
 *
 * @template E The event type
 *
 * @example
 * ```ts
 * type ConnectionHandler = IEventHandler<'connection'>
 * // (client: IClientConnection) => void
 *
 * const handler: ConnectionHandler = (client) => {
 *   console.log('Connected:', client.id)
 * }
 * ```
 */
export type IEventHandler<E extends IServerEventType> = IServerEventMap[E]

// ============================================================
// EVENT DATA TYPE EXTRACTOR
// ============================================================

/**
 * Extract event handler parameter types from event map
 *
 * @template E The event type
 *
 * @example
 * ```ts
 * type ConnectionParams = IEventDataType<'connection'>
 * // [IClientConnection]
 *
 * type MessageParams = IEventDataType<'message'>
 * // [IClientConnection, Message]
 * ```
 */
export type IEventDataType<E extends IServerEventType> =
  IServerEventMap[E] extends (...args: infer P) => any ? P : never

// ============================================================
// EVENT UNSUBSCRIBER TYPE
// ============================================================

/**
 * Event unsubscriber function type
 * Returned by event registration methods to cancel the subscription.
 *
 * @example
 * ```ts
 * const unsubscriber: IEventUnsubscriber = server.on('connection', handler)
 *
 * // Later: unsubscribe
 * unsubscriber()
 * ```
 */
export type IEventUnsubscriber = () => void

// ============================================================
// EVENT EMITTER INTERFACE
// ============================================================

/**
 * Event emitter interface
 * Type-safe event emission and listening.
 *
 * @template E The event map type
 *
 * @example
 * ```ts
 * class MyEmitter implements IEventEmitter<IServerEventMap> {
 *   private listeners: Map<keyof IServerEventMap, Set<any>> = new Map()
 *
 *   on<K extends keyof IServerEventMap>(
 *     event: K,
 *     handler: IServerEventMap[K]
 *   ): IEventUnsubscriber {
 *     // Implementation...
 *     return () => {}
 *   }
 *
 *   emit<K extends keyof IServerEventMap>(
 *     event: K,
 *     ...args: Parameters<IServerEventMap[K]>
 *   ): void {
 *     // Implementation...
 *   }
 * }
 * ```
 */
export interface IEventEmitter<E extends Record<string, any>> {
  /**
   * Register an event handler
   *
   * @template K The event key type
   * @param event - The event to listen for
   * @param handler - The event handler
   * @returns Unsubscribe function
   */
  on<K extends keyof E>(event: K, handler: E[K]): IEventUnsubscriber

  /**
   * Register a one-time event handler
   * The handler is automatically removed after first invocation.
   *
   * @template K The event key type
   * @param event - The event to listen for
   * @param handler - The event handler
   * @returns Unsubscribe function
   */
  once<K extends keyof E>(event: K, handler: E[K]): IEventUnsubscriber

  /**
   * Remove an event handler
   *
   * @template K The event key type
   * @param event - The event
   * @param handler - The handler to remove
   */
  off<K extends keyof E>(event: K, handler: E[K]): void

  /**
   * Emit an event to all registered handlers
   *
   * @template K The event key type
   * @param event - The event to emit
   * @param args - Arguments to pass to handlers
   */
  emit<K extends keyof E>(
    event: K,
    ...args: E[K] extends (...args: infer P) => any ? P : never
  ): void
}

// ============================================================
// EVENT LISTENER STORAGE TYPE
// ============================================================

/**
 * Event listener storage type
 * Internal type for storing event handlers.
 *
 * @template E The event map type
 */
export type IEventListenerStorage<E extends Record<string, any>> = {
  [K in keyof E]?: Set<E[K]>
}

// ============================================================
// ASYNC EVENT HANDLER TYPES
// ============================================================

/**
 * Async event handler type
 * Handler that returns a Promise.
 *
 * @template E The event type
 */
export type IAsyncEventHandler<E extends IServerEventType> = (
  ...args: IEventDataType<E>
) => void | Promise<void>

/**
 * Async event map
 * All handlers can be async.
 */
export interface IAsyncServerEventMap {
  connection: IAsyncEventHandler<'connection'>
  disconnection: IAsyncEventHandler<'disconnection'>
  message: IAsyncEventHandler<'message'>
  subscribe: IAsyncEventHandler<'subscribe'>
  unsubscribe: IAsyncEventHandler<'unsubscribe'>
  error: IAsyncEventHandler<'error'>
}
