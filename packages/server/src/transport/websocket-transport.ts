/**
 * WebSocket Transport
 * WebSocket-based transport implementation using the `ws` library.
 *
 * @remarks
 * This transport provides WebSocket server functionality including:
 * - Automatic connection management
 * - Ping/pong keepalive for connection health monitoring
 * - Message parsing and routing
 * - Graceful connection cleanup
 *
 * @module transport/websocket-transport
 */

import { BaseTransport } from './base-transport'
import type {
  ClientId,
  IServerTransport,
  IServerTransportConfig,
} from '../types'
import {
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_WS_PATH,
} from '../config'

// Import ws library - WebSocketServer is a named export
import { WebSocketServer as WsServer } from 'ws'

// Instance types
type WebSocketInstance = InstanceType<(typeof import('ws'))['default']>
type ServerInstance = WsServer

/**
 * WebSocket server transport configuration
 * Internal type that merges IServerTransportConfig with ws-specific options
 * @internal
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
 * WebSocket server transport
 * Implements IServerTransport using the `ws` library.
 * Extends BaseTransport which inherits from EventEmitter.
 *
 * @remarks
 * The transport manages WebSocket connections, handles incoming messages,
 * and provides connection lifecycle events.
 *
 * @example
 * ```typescript
 * import { WebSocketServerTransport } from '@synnel/server/transport'
 * import { createServer } from 'http'
 *
 * const httpServer = createServer()
 * const transport = new WebSocketServerTransport({
 *   server: httpServer,
 *   path: '/ws',
 *   enablePing: true,
 *   pingInterval: 5000
 * })
 * ```
 */
export class WebSocketServerTransport
  extends BaseTransport
  implements IServerTransport
{
  private readonly wsServer: ServerInstance
  private readonly config: Required<
    Omit<WebSocketServerTransportConfig, 'ServerConstructor'>
  >
  private pingTimer?: ReturnType<typeof setInterval>
  private nextId = 0

  /**
   * Create a new WebSocket server transport
   *
   * @param config - Transport configuration
   * @param config.server - HTTP server to attach to
   * @param config.path - WebSocket path (default: '/synnel')
   * @param config.maxPayload - Maximum message size in bytes (default: 1048576)
   * @param config.enablePing - Enable ping/pong keepalive (default: true)
   * @param config.pingInterval - Ping interval in ms (default: 30000)
   * @param config.pingTimeout - Ping timeout in ms (default: 5000)
   * @param config.connections - Optional existing connections map
   * @param config.ServerConstructor - Custom WebSocket server constructor
   *
   * @example
   * ```typescript
   * const transport = new WebSocketServerTransport({
   *   server: httpServer,
   *   path: '/ws',
   *   enablePing: true,
   *   pingInterval: 10000
   * })
   * ```
   */
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

    if (this.config.enablePing) {
      this.startPingTimer()
    }
  }

  /**
   * Start the transport
   *
   * The WebSocket server is already started in the constructor.
   * This method exists for compatibility with the transport interface.
   *
   * @example
   * ```typescript
   * await transport.start()
   * ```
   */
  async start(): Promise<void> {
    // WebSocket server is already started in constructor
    // This method exists for compatibility with the transport interface
  }

  /**
   * Set up event handlers for the WebSocket server
   *
   * @internal
   */
  private setupEventHandlers(): void {
    this.wsServer.on('connection', (socket: WebSocketInstance) => {
      this.handleConnection(socket)
    })

    this.wsServer.on('error', (error: Error) => {
      this.emit('error', error)
    })
  }

  /**
   * Handle a new WebSocket connection
   *
   * Creates a client connection, registers it, and sets up event handlers.
   *
   * @internal
   * @param socket - The WebSocket instance
   */
  private handleConnection(socket: WebSocketInstance): void {
    const clientId = `client-${this.nextId++}` as ClientId
    const connectedAt = Date.now()

    const connection = {
      socket,
      id: clientId,
      connectedAt,
      lastPingAt: connectedAt,
    }

    this.connections.set(clientId, connection)

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

  /**
   * Handle a message from a client
   *
   * Parses the message and emits it as a message event.
   * Updates lastPingAt for PONG signals.
   *
   * @internal
   * @param clientId - The client ID
   * @param data - Raw message data
   */
  private handleMessage(clientId: ClientId, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString())
      const connection = this.connections.get(clientId)

      if (
        connection &&
        message.type === 'signal' &&
        message.signal === 'PONG'
      ) {
        connection.lastPingAt = Date.now()
      }
      // Emit message event via inherited EventEmitter
      this.emit('message', clientId, message)
    } catch (error) {
      this.emit('error', error as Error)
    }
  }

  /**
   * Handle a client disconnection
   *
   * Emits the disconnection event and removes the client from connections.
   *
   * @internal
   * @param clientId - The client ID
   */
  private handleDisconnection(clientId: ClientId): void {
    this.emit('disconnection', clientId)
    this.connections.delete(clientId)
  }

  /**
   * Set up ping/pong handlers for a connection
   *
   * @internal
   * @param clientId - The client ID
   * @param socket - The WebSocket instance
   */
  private setupPingPong(clientId: ClientId, socket: WebSocketInstance): void {
    socket.on('pong', () => {
      const connection = this.connections.get(clientId)
      if (connection) {
        connection.lastPingAt = Date.now()
      }
    })
  }

  /**
   * Start the ping timer for connection health monitoring
   *
   * @internal
   */
  private startPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
    }

    this.pingTimer = setInterval(() => {
      this.checkConnections()
    }, this.config.pingInterval)
  }

  /**
   * Check all connections for timeout and send pings
   *
   * Closes connections that haven't responded within the timeout period.
   * Sends pings to active connections.
   *
   * @internal
   */
  private checkConnections(): void {
    const now = Date.now()
    const connections = Array.from(this.connections.values())

    for (const connection of connections) {
      const socket = connection.socket as WebSocketInstance
      const lastPing = connection.lastPingAt ?? connection.connectedAt

      // Check for timeout
      if (now - lastPing > this.config.pingInterval + this.config.pingTimeout) {
        socket.close(1000, 'Ping timeout')
        continue
      }

      // Send ping if socket is open
      if (socket.readyState === 1) {
        socket.ping()
      }
    }
  }

  /**
   * Stop the transport and close all connections
   *
   * Stops the ping timer, closes all client connections,
   * clears the connections map, and closes the WebSocket server.
   *
   * @example
   * ```typescript
   * await server.stop()
   * transport.stop() // Close all connections
   * ```
   */
  stop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = undefined
    }

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
  IServerTransportConfig,
} from '../types'
