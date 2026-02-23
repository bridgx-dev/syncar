/**
 * WebSocket Server Transport
 * Server-side WebSocket transport using ws library
 */

import type { Message } from './protocol.js'
import { WebSocketServer as WSWebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'node:events'
import type { Timestamp, ClientId } from './types.js'

export type ServerTransportEvent =
  | 'connection'
  | 'disconnection'
  | 'message'
  | 'error'

// Declaration Merging to fix 'isAlive' typing
declare module 'ws' {
  interface WebSocket {
    isAlive: boolean
  }
}

export interface ServerTransportConfig {
  /**
   * Existing HTTP server to attach WebSocket to
   * Works with Express, Fastify, plain Node.js http.Server, etc.
   *
   * @example
   * ```ts
   * import express from 'express'
   * import { createServer } from 'http'
   *
   * const app = express()
   * const server = createServer(app)
   *
   * const transport = createWebSocketServerTransport({ server })
   * ```
   */
  server: unknown

  /**
   * Path for WebSocket connections
   * If not provided, the WebSocket server will use its default path
   */
  path?: string

  /**
   * Maximum message size in bytes
   * @default 1048576 (1MB)
   */
  maxPayload?: number

  /**
   * Enable client ping/pong
   * @default true
   */
  enablePing?: boolean

  /**
   * Ping interval in ms
   * @default 30000
   */
  pingInterval?: number

  /**
   * Ping timeout in ms
   * @default 5000
   */
  pingTimeout?: number

  /**
   * Custom WebSocket Server (for testing)
   */
  ServerConstructor?: unknown
}

export type ServerConnection = {
  id: string

  /**
   * Connected timestamp
   */
  connectedAt: Timestamp

  /**
   * Last ping timestamp
   */
  lastPingAt?: Timestamp

  /** WebSocket instance for this connection */
  socket: WebSocket
}

/**
 * WebSocket Server Transport
 * Implements the ServerTransport interface using the ws library
 * Operates purely as a bound listener onto an externally provided HTTP server
 */
export class WebSocketServerTransport extends EventEmitter {
  private wsServer: WSWebSocketServer
  private connections: Map<string, ServerConnection> = new Map()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private startedAt: number

  private readonly config: ServerTransportConfig

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

  override on<K = ServerTransportEvent>(
    eventName: K,
    listener: (...args: any[]) => void,
  ): this {
    return super.on(eventName as string, listener)
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
      socket: ws,
      id: clientId,
      connectedAt: Date.now(),
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

    ws.on('close', () => {
      this.emit('disconnection', clientId)
      // Only delete AFTER emitting so the main server registry can clean it up
      this.connections.delete(clientId)
    })

    ws.on('error', (error: Error) => {
      this.emit('error', error)
    })

    this.emit('connection', connection)
  }

  /**
   * Send a message to a specific client
   */
  async sendToClient(clientId: string, message: Message): Promise<void> {
    const conn = this.connections.get(clientId)
    if (!conn) {
      throw new Error(`Client not found: ${clientId}`)
    }

    if (conn.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} is not connected`)
    }

    try {
      conn.socket.send(JSON.stringify(message))
    } catch (error) {
      this.emit('error', error as Error)
      throw error
    }
  }

  /**
   * Get all connected clients
   */
  getClients() {
    return Array.from(this.connections.values())
  }

  /**
   * Get a specific client by ID
   */
  getClient(clientId: string) {
    return this.connections.get(clientId)
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): ClientId {
    return Math.random().toString(36).substring(2, 11)
  }
}
