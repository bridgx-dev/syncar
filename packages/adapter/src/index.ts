/**
 * @synnel/adapter
 *
 * WebSocket transport adapter for Synnel v2
 *
 * @example
 * ```ts
 * // Client-side
 * import { createWebSocketClientTransport } from '@synnel/adapter/client'
 *
 * const transport = createWebSocketClientTransport({
 *   url: 'ws://localhost:3000',
 *   reconnect: true,
 * })
 *
 * await transport.connect()
 * ```
 *
 * @example
 * ```ts
 * // Server-side (standalone)
 * import { createWebSocketServerTransport } from '@synnel/adapter/server'
 *
 * const server = createWebSocketServerTransport({
 *   port: 3000,
 *   path: '/synnel',
 * })
 *
 * await server.start()
 * ```
 *
 * @example
 * ```ts
 * // Server-side (attached to Express)
 * import express from 'express'
 * import { createServer } from 'http'
 * import { createWebSocketServerTransport } from '@synnel/adapter/server'
 *
 * const app = express()
 * const httpServer = createServer(app)
 *
 * const transport = createWebSocketServerTransport({
 *   server: httpServer,
 *   path: '/synnel',
 * })
 *
 * await transport.start()
 * ```
 */

// Types
export type {
  TransportStatus,
  TransportConfig,
  Transport,
  TransportEventMap,
  ServerTransportConfig,
  ServerTransport,
  ServerTransportEventMap,
  ClientConnection,
  CloseEvent,
  ReconnectionState,
} from './types.js'

// Client
export {
  WebSocketClientTransport,
  createWebSocketClientTransport,
} from './client.js'
