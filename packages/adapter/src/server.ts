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
import { EventEmitter } from 'node:events'

// Declaration Merging to fix 'isAlive' typing
declare module 'ws' {
  interface WebSocket {
    isAlive: boolean
  }
}

/**
 * Wrapper for WebSocket server connections
 */
interface ServerConnection {
  ws: InstanceType<typeof WebSocket>
  info: ClientConnection
}

/**
 * WebSocket Server Transport
 * Implements the ServerTransport interface using the ws library
 * Operates purely as a bound listener onto an externally provided HTTP server
 */
export class WebSocketServerTransport extends EventEmitter implements ServerTransport {
  private wsServer: WSWebSocketServer
  private connections: Map<string, ServerConnection> = new Map()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private startedAt: number

  private readonly config: ServerTransportConfig & {
    path: string
    maxPayload: number
    enablePing: boolean
    pingInterval: number
    pingTimeout: number
  }

  constructor(config: ServerTransportConfig) {
    super()
    this.config = {
      ...config,
      path: config.path ?? '/',
      maxPayload: config.maxPayload ?? 1048576,
      enablePing: config.enablePing ?? true,
      pingInterval: config.pingInterval ?? 30000,
      pingTimeout: config.pingTimeout ?? 5000,
    }

    const ServerConstructor =
      (this.config.ServerConstructor as typeof WSWebSocketServer) ??
      WSWebSocketServer

    // Attach to the provided HTTP server
    this.wsServer = new ServerConstructor({
      server: this.config.server as any,
      path: this.config.path,
      maxPayload: this.config.maxPayload,
    })

    this.startedAt = Date.now()

    this.wsServer.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws)
    })

    this.wsServer.on('error', (error: Error) => {
      this.emit('error', error)
    })

    // Start ping interval natively handling the loop over `wsServer.clients`
    if (this.config.enablePing) {
      this.startPingInterval()

      this.wsServer.on('close', () => {
        if (this.pingInterval) clearInterval(this.pingInterval)
      })
    }
  }

  /**
   * Start the native ping loop iterating over internally maintained socket sets
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.wsServer.clients.forEach((socket) => {
        if (socket.isAlive === false) return socket.terminate()

        socket.isAlive = false
        socket.ping()
      })
    }, this.config.pingInterval)
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = this.generateClientId()

    // Heartbeat logic natively tracking isAlive marker
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })

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

    ws.on('close', (code: number, reason: Buffer) => {
      const closeEvent: CloseEvent = {
        wasClean: code === 1000,
        code,
        reason: reason.toString(),
      }

      this.emit('disconnection', clientId, closeEvent)

      // Only delete AFTER emitting so the main server registry can clean it up
      this.connections.delete(clientId)
    })

    ws.on('error', (error: Error) => {
      this.emit('error', error)
    })

    this.emit('connection', clientId)
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
  override on<E extends ServerTransportEventType>(
    event: E,
    handler: ServerTransportEventMap[E],
  ): this {
    return super.on(event, handler as (...args: any[]) => void)
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
      startedAt: this.startedAt,
    }
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
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
