/**
 * Server Factory
 * Factory function for convenient server creation.
 *
 * @module server/factory
 */

import type { IServerConfig, ISynnelServer } from '../types/server.js'
import type { IServerTransport } from '../types/transport.js'
import type { Server as HttpServer } from 'http'
import { SynnelServer } from './synnel-server.js'
import { WebSocketServerTransport } from '../transport/websocket-transport.js'
import {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
} from '../config/defaults.js'

// ============================================================
// SYNEL SERVER FACTORY
// ============================================================

/**
 * Create a Synnel server with automatic WebSocket transport setup
 *
 * This factory creates an HTTP server (if one is not provided),
 * sets up the WebSocket transport, and initializes the SynnelServer.
 *
 * @param config - Server configuration options
 * @returns Configured Synnel server instance
 *
 * @example
 * ```ts
 * import { createSynnelServer } from '@synnel/server'
 *
 * // Simple server with defaults
 * const server = createSynnelServer()
 * await server.start()
 *
 * // Custom port
 * const server = createSynnelServer({ port: 8080 })
 * await server.start()
 *
 * // With existing HTTP server
 * import { createServer } from 'node:http'
 * const httpServer = createServer()
 * const server = createSynnelServer({ server: httpServer })
 * await server.start()
 *
 * // With middleware
 * import { createAuthMiddleware } from '@synnel/server'
 * const authMiddleware = createAuthMiddleware({
 *   verifyToken: async (token) => verifyJwt(token)
 * })
 * const server = createSynnelServer({
 *   port: 3000,
 *   middleware: [authMiddleware]
 * })
 * await server.start()
 * ```
 */
export function createSynnelServer(config: IServerConfig = {}): ISynnelServer {
  let transport: IServerTransport

  // If transport is provided, use it directly
  if (config.transport) {
    transport = config.transport
  } else {
    // Import http module dynamically
    import('node:http').then((http) => {
      // If server is not provided, create one
      if (!config.server) {
        const port = config.port ?? DEFAULT_PORT
        const host = config.host ?? DEFAULT_HOST
        const httpServer = http.createServer()
        httpServer.listen(port, host)

        // Update config with the created server
        ;(config as { server: HttpServer }).server = httpServer
      }
    })

    // Create WebSocket transport
    transport = new WebSocketServerTransport({
      server: config.server as unknown,
      path: config.path ?? DEFAULT_PATH,
      maxPayload: (config as { maxPayload?: number }).maxPayload ?? DEFAULT_MAX_PAYLOAD,
      enablePing: config.enablePing,
      pingInterval: config.pingInterval ?? DEFAULT_PING_INTERVAL,
      pingTimeout: config.pingTimeout ?? DEFAULT_PING_TIMEOUT,
    })
  }

  // Create SynnelServer with the transport
  const server = new SynnelServer({
    ...config,
    transport,
  })

  return server
}

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IServerConfig,
  ISynnelServer,
  IServerStats,
} from '../types/server.js'

export type { IServerTransport } from '../types/transport.js'
