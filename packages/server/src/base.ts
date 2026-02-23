/**
 * WebSocket Server Transport
 * Server-side WebSocket transport using ws library
 */

import { EventEmitter } from 'node:events'
import { WebSocketServer as WSWebSocketServer, WebSocket } from 'ws'

import type { Message } from '@synnel/types'
import { generateClientId } from '@synnel/lib'

import type {
  ServerTransportConfig,
  ClientConnection,
  ServerTransportEvent,
} from './types.js'

// Declaration Merging to fix 'isAlive' typing
declare module 'ws' {
  interface WebSocket {
    isAlive: boolean
  }
}

/**
 * WebSocket Server Transport
 * Implements the ServerTransport interface using the ws library
 * Operates purely as a bound listener onto an externally provided HTTP server
 */
export class WebSocketServerTransport extends EventEmitter {
  private wsServer: WSWebSocketServer
  private connections: Map<string, ClientConnection> = new Map()
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
    const clientId = generateClientId()

    // Heartbeat logic natively tracking isAlive marker
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })

    const connection: ClientConnection = {
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

    const socket = conn.socket as WebSocket
    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} is not connected`)
    }

    try {
      socket.send(JSON.stringify(message))
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
}
