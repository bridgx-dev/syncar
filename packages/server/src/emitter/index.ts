/**
 * Emitter Module
 * Type-safe event emitter for the Synnel server.
 *
 * @module emitter
 *
 * @example
 * ```ts
 * import { EventEmitter } from '@synnel/server/emitter'
 * import type { IServerEventMap } from '@synnel/server/types'
 *
 * const emitter = new EventEmitter<IServerEventMap>()
 *
 * emitter.on('connection', (client) => {
 *   console.log('Client connected:', client.id)
 * })
 *
 * emitter.emit('connection', client)
 * ```
 */

export { EventEmitter } from './event-emitter.js'

// Re-export types for convenience
export type {
  IEventEmitter,
  IEventUnsubscriber,
  IServerEventType,
  IServerEventMap,
  IEventHandler,
  IEventDataType,
  IAsyncEventHandler,
  IAsyncServerEventMap,
} from '../types/index.js'
