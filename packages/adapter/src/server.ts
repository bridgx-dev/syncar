/**
 * WebSocket Server Transport
 * Server-side WebSocket transport using ws library
 */

import type {
  ServerTransport,
  ServerTransportConfig,
  ServerTransportEventType,
  ServerTransportEventMap,
  ClientConnection,
  CloseEvent,
} from './types.js'
import type { Message } from '@synnel/core'
import { WebSocketServer as WSWebSocketServer, WebSocket } from 'ws'

/**
 * Wrapper for WebSocket server connections
 */
interface ServerConnection {
  ws: InstanceType<typeof WebSocket>
  info: ClientConnection
  pingTimeout?: ReturnType<typeof setTimeout>
}

/**
 * WebSocket Server Transport
 * Implements the ServerTransport interface using the ws library
 */
export class WebSocketServerTransport implements ServerTransport {
  private wsServer: WSWebSocketServer | null = null
  private connections: Map<string, ServerConnection> = new Map()
  private eventHandlers: Map<
    ServerTransportEventType,
    Set<ServerTransportEventMap[ServerTransportEventType]>
  > = new Map()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private startedAt: number | null = null

  private readonly config: ServerTransportConfig & {
    path: string
    maxPayload: number
    enablePing: boolean
    pingInterval: number
    pingTimeout: number
  }

  constructor(config: ServerTransportConfig) {
    this.config = {
      ...config,
      path: config.path ?? '/',
      maxPayload: config.maxPayload ?? 1048576,
      enablePing: config.enablePing ?? true,
      pingInterval: config.pingInterval ?? 30000,
      pingTimeout: config.pingTimeout ?? 5000,
    }
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.wsServer) {
      throw new Error('Server is already running')
    }

    return new Promise((resolve, reject) => {
      try {
        const ServerConstructor =
          (this.config.ServerConstructor as typeof WSWebSocketServer) ??
          WSWebSocketServer

        // Attach to the provided HTTP server
        this.wsServer = new ServerConstructor({
          server: this.config.server as any,
          path: this.config.path,
          maxPayload: this.config.maxPayload,
        })

        // For attached servers, we consider it "started" immediately
        this.startedAt = Date.now()

        // Start ping interval if enabled
        if (this.config.enablePing) {
          this.startPingInterval()
        }

        this.wsServer.on('connection', (ws: WebSocket) => {
          this.handleConnection(ws)
        })

        this.wsServer.on('error', (error: Error) => {
          this.emit('error', error)
        })

        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    // Close all connections
    for (const [clientId, conn] of this.connections) {
      try {
        conn.ws.terminate()
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.connections.clear()

    // Close WebSocket server (but not the underlying HTTP server)
    if (this.wsServer) {
      return new Promise((resolve) => {
        this.wsServer!.close((err) => {
          this.wsServer = null
          this.startedAt = null
          if (err) {
            console.error('Error closing WebSocket server:', err)
          }
          resolve()
        })
      })
    }
  }

  /**
   * Send a message to a specific client
   */
  async sendToClient(clientId: string, message: Message): Promise<void> {
    const conn = this.connections.get(clientId)
    if (!conn) {
      throw new Error(`Client not found: ${clientId}`)
    }

    if (conn.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} is not connected`)
    }

    try {
      conn.ws.send(JSON.stringify(message))
    } catch (error) {
      this.emit('error', error as Error)
      throw error
    }
  }

  /**
   * Send a message to all connected clients
   */
  async broadcast(message: Message): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [clientId, conn] of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        promises.push(
          (async () => {
            try {
              conn.ws.send(JSON.stringify(message))
            } catch (error) {
              this.emit('error', error as Error)
            }
          })(),
        )
      }
    }

    await Promise.all(promises)
  }

  /**
   * Disconnect a specific client
   */
  async disconnectClient(
    clientId: string,
    code?: number,
    reason?: string,
  ): Promise<void> {
    const conn = this.connections.get(clientId)
    if (!conn) {
      throw new Error(`Client not found: ${clientId}`)
    }

    conn.ws.close(code ?? 1000, reason ?? 'Disconnected by server')
  }

  /**
   * Get all connected clients
   */
  getClients(): ClientConnection[] {
    return Array.from(this.connections.values()).map((conn) => conn.info)
  }

  /**
   * Get a specific client by ID
   */
  getClient(clientId: string): ClientConnection | undefined {
    return this.connections.get(clientId)?.info
  }

  /**
   * Register an event handler
   */
  on<E extends ServerTransportEventType>(
    event: E,
    handler: ServerTransportEventMap[E],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    this.eventHandlers.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.delete(handler)
      }
    }
  }

  /**
   * Get server info
   */
  getServerInfo(): {
    path?: string
    startedAt?: number
  } {
    return {
      path: this.config.path,
      startedAt: this.startedAt ?? undefined,
    }
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    // Generate unique client ID
    const clientId = this.generateClientId()

    const connection: ServerConnection = {
      ws,
      info: {
        id: clientId,
        status: 'connected',
        connectedAt: Date.now(),
        metadata: {},
      },
    }

    this.connections.set(clientId, connection)

    // Set up ping timeout for this client
    // (We only start the timeout when we actually send a ping)

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as Message
        this.emit('message', clientId, message)
      } catch (error) {
        this.emit(
          'error',
          new Error(`Failed to parse message from ${clientId}`),
        )
      }
    })

    // Handle connection close
    ws.on('close', (code: number, reason: Buffer) => {
      const conn = this.connections.get(clientId)
      if (conn && conn.pingTimeout) {
        clearTimeout(conn.pingTimeout)
      }

      this.connections.delete(clientId)

      const closeEvent: CloseEvent = {
        wasClean: code === 1000,
        code,
        reason: reason.toString(),
      }

      this.emit('disconnection', clientId, closeEvent)
    })

    // Handle connection errors
    ws.on('error', (error: Error) => {
      this.emit('error', error)
    })

    // Handle pong responses
    ws.on('pong', () => {
      const conn = this.connections.get(clientId)
      if (conn) {
        conn.info.lastPingAt = Date.now()
        // Client sent a pong, they're alive. Cancel their death timer!
        if (conn.pingTimeout) {
          clearTimeout(conn.pingTimeout)
          conn.pingTimeout = undefined
        }
      }
    })

    // Emit connection event
    this.emit('connection', clientId)
  }

  /**
   * Start the ping interval for all clients
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      for (const [clientId, conn] of this.connections) {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.ping()
          // Start the death timer *after* sending the ping
          this.setupClientPingTimeout(clientId)
        }
      }
    }, this.config.pingInterval)
  }

  /**
   * Set up ping timeout for a specific client
   */
  private setupClientPingTimeout(clientId: string): void {
    const conn = this.connections.get(clientId)
    if (!conn) return

    if (conn.pingTimeout) {
      clearTimeout(conn.pingTimeout)
    }

    conn.pingTimeout = setTimeout(() => {
      // Client didn't respond to ping, disconnect
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.terminate()
      }
    }, this.config.pingTimeout)
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<E extends ServerTransportEventType>(
    event: E,
    ...args: Parameters<ServerTransportEventMap[E]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          ;(handler as any)(...args)
        } catch (error) {
          console.error(`Error in ${event} handler:`, error)
        }
      }
    }
  }
}

/**
 * Factory function to create a WebSocket server transport
 */
export function createWebSocketServerTransport(
  config: ServerTransportConfig,
): ServerTransport {
  return new WebSocketServerTransport(config)
}
