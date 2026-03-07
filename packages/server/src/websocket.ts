import { EventEmitter } from 'node:events'
import { WebSocketServer as WsServer } from 'ws'
import {
    MessageType,
    SignalType,
    type ClientId,
    type IServerTransport,
    type IClientConnection,
} from './types'
import {
    DEFAULT_MAX_PAYLOAD,
    DEFAULT_PING_INTERVAL,
    DEFAULT_PING_TIMEOUT,
    DEFAULT_WS_PATH,
} from './config'

// Instance types
type WebSocketInstance = any
type ServerInstance = WsServer

/**
 * Server transport configuration options
 */
export interface IServerTransportConfig {
    /** HTTP server to attach WebSocket to */
    server: any

    /** Path for WebSocket connections */
    path?: string

    /** Maximum message size in bytes */
    maxPayload?: number

    /** Enable client ping/pong */
    enablePing?: boolean

    /** Ping interval in milliseconds */
    pingInterval?: number

    /** Ping timeout in milliseconds */
    pingTimeout?: number

    /** Shared connection map */
    connections?: Map<ClientId, IClientConnection>
}

export interface WebSocketServerTransportConfig extends IServerTransportConfig {
    ServerConstructor?: new (config: {
        server: any
        path?: string
        maxPayload?: number
    }) => ServerInstance
}

/**
 * WebSocket Server Transport
 * Handles low-level WebSocket communication using the 'ws' library.
 */
export class WebSocketServerTransport
    extends EventEmitter
    implements IServerTransport {
    /** Map of connected clients by ID */
    public readonly connections: Map<ClientId, IClientConnection>

    private readonly wsServer: ServerInstance
    private readonly config: Required<
        Omit<WebSocketServerTransportConfig, 'ServerConstructor'>
    >
    private pingTimer?: ReturnType<typeof setInterval>
    private nextId = 0

    constructor(config: WebSocketServerTransportConfig) {
        super()
        this.setMaxListeners(100)

        this.connections = config.connections ?? new Map()

        this.config = {
            server: config.server,
            path: config.path ?? DEFAULT_WS_PATH,
            maxPayload: config.maxPayload ?? DEFAULT_MAX_PAYLOAD,
            enablePing: config.enablePing ?? true,
            pingInterval: config.pingInterval ?? DEFAULT_PING_INTERVAL,
            pingTimeout: config.pingTimeout ?? DEFAULT_PING_TIMEOUT,
            connections: this.connections,
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
            socket: socket as any, // Cast to avoid WebSocket version mismatch in types
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

        // Emit connection event
        this.emit('connection', connection)
    }

    private handleMessage(clientId: ClientId, data: Buffer): void {
        try {
            const message = JSON.parse(data.toString())
            const connection = this.connections.get(clientId)

            if (
                connection &&
                message.type === MessageType.SIGNAL &&
                message.signal === SignalType.PONG
            ) {
                connection.lastPingAt = Date.now()
            }

            // Emit message event
            this.emit('message', clientId, message)
        } catch (error) {
            this.emit('error', error as Error)
        }
    }

    private handleDisconnection(clientId: ClientId): void {
        this.emit('disconnection', clientId)
        this.connections.delete(clientId)
    }

    private setupPingPong(clientId: ClientId, socket: WebSocketInstance): void {
        socket.on('pong', () => {
            const connection = this.connections.get(clientId)
            if (connection) {
                connection.lastPingAt = Date.now()
            }
        })
    }

    private startPingTimer(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer)
        }

        this.pingTimer = setInterval(() => {
            this.checkConnections()
        }, this.config.pingInterval)
    }

    private checkConnections(): void {
        const now = Date.now()
        const connections = Array.from(this.connections.values())

        for (const connection of connections) {
            const socket = connection.socket as unknown as WebSocketInstance
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
}
