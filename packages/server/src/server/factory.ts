import type { IServerConfig, IServerOptions, ISynnelServer, IServerTransport } from '../types'
import { SynnelServer } from './synnel-server'
import { ClientRegistry } from '../registry'
import { WebSocketServerTransport } from '../transport'
import {
  DEFAULT_SERVER_CONFIG,
  DEFAULT_MAX_PAYLOAD,
} from '../config'

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
  // Create or use injected client registry
  const registry = config.registry ?? new ClientRegistry()

  // Merge defaults and use defined registry
  const serverConfig: IServerOptions = {
    ...DEFAULT_SERVER_CONFIG,
    middleware: [],
    ...config,
    registry,
  }

  let transport: IServerTransport

  // If transport is provided, use it directly
  if (serverConfig.transport) {
    transport = serverConfig.transport
  } else {
    // Import http module dynamically
    import('node:http').then((http) => {
      // If server is not provided, create one
      if (!serverConfig.server) {
        const httpServer = http.createServer()
        httpServer.listen(serverConfig.port, serverConfig.host)

        // Update config with the created server
        // Note: this may run after WebSocketServerTransport is created due to async import
        serverConfig.server = httpServer
      }
    })

    // Create WebSocket transport with registry connections
    transport = new WebSocketServerTransport({
      server: serverConfig.server as unknown,
      path: serverConfig.path,
      maxPayload: (config as { maxPayload?: number }).maxPayload ?? DEFAULT_MAX_PAYLOAD,
      enablePing: serverConfig.enablePing,
      pingInterval: serverConfig.pingInterval,
      pingTimeout: serverConfig.pingTimeout,
      connections: registry.connections,
    })
  }

  // Create SynnelServer with the transport and registry
  return new SynnelServer({ ...serverConfig, transport })
}
