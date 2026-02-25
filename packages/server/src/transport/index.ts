/**
 * Transport Module
 * Transport layer implementations for WebSocket communication.
 *
 * @module transport
 *
 * @example
 * ```ts
 * import { WebSocketServerTransport } from '@synnel/server/transport'
 *
 * const transport = new WebSocketServerTransport({
 *   server: httpServer,
 *   path: '/ws'
 * })
 *
 * transport.on('connection', (conn) => {
 *   console.log('Client connected:', conn.id)
 * })
 * ```
 */

export { BaseTransport } from './base-transport'
export { WebSocketServerTransport } from './websocket-transport'
