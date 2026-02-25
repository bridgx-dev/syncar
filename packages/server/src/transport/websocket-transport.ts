/**
 * WebSocket Transport
 * WebSocket-based transport implementation using the `ws` library.
 *
 * @module transport/websocket-transport
 */

import { BaseTransport } from './base-transport'
import type {
  IClientConnection,
  ClientId,
  Message,
  IServerTransport,
  IServerTransportConfig,
} from '../types'
import {
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_WS_PATH,
} from '../config'

// Import ws library
import wsModule from 'ws'

// Extract WebSocketServer from ws module
const { WebSocketServer: WsServer } = wsModule as any

// Instance types
type WsModule = typeof import('ws')
type WebSocketInstance = InstanceType<WsModule['default']>
type ServerInstance = InstanceType<WsModule['WebSocketServer']>

// ============================================================
// WEBSOCKET SERVER TRANSPORT
// ============================================================

/**
 * WebSocket server transport configuration
 * Internal type that merges IServerTransportConfig with ws-specific options
 */
interface WebSocketServerTransportConfig extends IServerTransportConfig {
  server: unknown
  path?: string
  maxPayload?: number
  enablePing?: boolean
  pingInterval?: number
  pingTimeout?: number
  ServerConstructor?: new (config: {
    server: unknown
    path?: string
    maxPayload?: number
  }) => ServerInstance
}

/**
 * Client ping/pong tracking data
 * Kept separate from IClientConnection since its properties are readonly
 */
interface ClientPingData {
  pingTimer?: ReturnType<typeof setInterval>
  pongTimer?: ReturnType<typeof setTimeout>
  lastPingAt?: number
}

/**
 * WebSocket server transport
 * Implements IServerTransport using the `ws` library.
 * Extends BaseTransport which inherits from EventEmitter.
 */
export class WebSocketServerTransport
  extends BaseTransport
  implements IServerTransport
{
  private readonly wsServer: ServerInstance
  private readonly config: Required<
    Omit<WebSocketServerTransportConfig, 'ServerConstructor'>
  >
  private readonly clientPingData: Map<ClientId, ClientPingData> = new Map()
  private nextId = 0

  constructor(config: WebSocketServerTransportConfig) {
    super(config.connections)

    this.config = {
      server: config.server,
      path: config.path ?? DEFAULT_WS_PATH,
      maxPayload: config.maxPayload ?? DEFAULT_MAX_PAYLOAD,
      enablePing: config.enablePing ?? true,
      pingInterval: config.pingInterval ?? DEFAULT_PING_INTERVAL,
      pingTimeout: config.pingTimeout ?? DEFAULT_PING_TIMEOUT,
      connections: config.connections ?? this.connections,
    }

    const ServerConstructor = config.ServerConstructor ?? WsServer
    this.wsServer = new ServerConstructor({
      server: this.config.server as any,
      path: this.config.path,
      maxPayload: this.config.maxPayload,
    })

    this.setupEventHandlers()
  }

  async sendToClient(clientId: ClientId, message: Message): Promise<void> {
    const client = this.connections.get(clientId)
    if (!client) {
      throw new Error(`Client not found: ${clientId}`)
    }

    const socket = client.socket as WebSocketInstance
    if (socket.readyState !== 1) {
      throw new Error(`Client not connected: ${clientId}`)
    }

    return new Promise<void>((resolve, reject) => {
      try {
        socket.send(JSON.stringify(message), (error) => {
          if (error) reject(error)
          else resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  private setupEventHandlers(): void {
    this.wsServer.on('connection', (socket: WebSocketInstance) => {
      this.handleConnection(socket)
    })

    this.wsServer.on('error', (error: Error) => {
      this.emit('error', error)
    })
  }

  private handleConnection(socket: WebSocketInstance): void {
    const clientId = `client-${this.nextId++}` as ClientId
    const connectedAt = Date.now()

    const connection: IClientConnection = {
      id: clientId,
      connectedAt,
      lastPingAt: undefined,
      socket,
    }

    this.connections.set(clientId, connection)
    this.clientPingData.set(clientId, {})

    socket.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data)
    })

    socket.on('close', (_code: number, _reason: Buffer) => {
      this.handleDisconnection(clientId)
    })

    socket.on('error', (error: Error) => {
      this.emit('error', error)
    })

    if (this.config.enablePing) {
      this.setupPingPong(clientId, socket)
    }

    // Emit connection event via inherited EventEmitter
    this.emit('connection', connection)
  }

  private handleMessage(clientId: ClientId, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as Message
      const pingData = this.clientPingData.get(clientId)
      if (
        pingData &&
        message.type === 'signal' &&
        (message as any).signal === 'PONG'
      ) {
        pingData.lastPingAt = Date.now()
      }
      // Emit message event via inherited EventEmitter
      this.emit('message', clientId, message)
    } catch (error) {
      this.emit('error', error as Error)
    }
  }

  private handleDisconnection(clientId: ClientId): void {
    this.emit('disconnection', clientId)
    this.cleanupPingData(clientId)
    this.connections.delete(clientId)
  }

  private setupPingPong(clientId: ClientId, socket: WebSocketInstance): void {
    const pingData = this.clientPingData.get(clientId)
    if (!pingData) return

    pingData.pingTimer = setInterval(() => {
      if (socket.readyState === 1) {
        socket.ping()
        pingData.lastPingAt = Date.now()

        pingData.pongTimer = setTimeout(() => {
          if (socket.readyState === 1) {
            socket.close(1000, 'Ping timeout')
          }
        }, this.config.pingTimeout)
      }
    }, this.config.pingInterval)

    socket.on('close', () => {
      this.cleanupPingData(clientId)
    })

    socket.on('pong', () => {
      if (pingData.pongTimer) {
        clearTimeout(pingData.pongTimer)
        pingData.pongTimer = undefined
      }
      if (pingData) {
        pingData.lastPingAt = Date.now()
      }
    })
  }

  private cleanupPingData(clientId: ClientId): void {
    const pingData = this.clientPingData.get(clientId)
    if (pingData) {
      if (pingData.pingTimer) clearInterval(pingData.pingTimer)
      if (pingData.pongTimer) clearTimeout(pingData.pongTimer)
      this.clientPingData.delete(clientId)
    }
  }

  stop(): void {
    for (const clientId of this.clientPingData.keys()) {
      this.cleanupPingData(clientId)
    }
    this.clientPingData.clear()

    for (const client of Array.from(this.connections.values())) {
      try {
        ;(client.socket as WebSocketInstance).close(
          1000,
          'Server shutting down',
        )
      } catch {
        // Ignore
      }
    }

    this.connections.clear()
    // Remove all event listeners via inherited EventEmitter
    this.removeAllListeners()
    this.wsServer.close()
  }
}

export type {
  IServerTransport,
  IClientConnection,
  ClientId,
  Message,
  IServerTransportConfig,
} from '../types'
