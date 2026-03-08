import { EventEmitter } from 'node:events'
import { WebSocketServer as WsServer, type ServerOptions as WsServerOptions, type WebSocket } from 'ws'
import {
    MessageType,
    SignalType,
    type ClientId,
    type IClientConnection,
    type ILogger,
    type IdGenerator,
} from './types'
import {
    DEFAULT_MAX_PAYLOAD,
    DEFAULT_PING_INTERVAL,
    DEFAULT_PING_TIMEOUT,
    DEFAULT_WS_PATH,
} from './config'
import { generateClientId } from './utils'

// Instance types
type ServerInstance = WsServer

export interface WebSocketServerTransportConfig extends WsServerOptions {
    /** Enable client ping/pong */
    enablePing?: boolean

    /** Ping interval in milliseconds */
    pingInterval?: number

    /** Ping timeout in milliseconds */
    pingTimeout?: number

    /** Shared connection map */
    connections?: Map<ClientId, IClientConnection>

    /** Custom ID generator for new connections */
    generateId?: IdGenerator // Updated type to IdGenerator

    ServerConstructor?: new (config: WsServerOptions) => ServerInstance

    /** Logger instance */
    logger?: ILogger
}

/**
 * WebSocket Server Transport
 * Handles low-level WebSocket communication using the 'ws' library.
 */
export class WebSocketServerTransport extends EventEmitter {
    /** Map of connected clients by ID */
    public readonly connections: Map<ClientId, IClientConnection>

    private readonly wsServer: ServerInstance
    private readonly config: WebSocketServerTransportConfig & {
        pingInterval: number
        pingTimeout: number
        enablePing: boolean
    }
    private pingTimer?: ReturnType<typeof setInterval>
    private authenticator?: (request: import('node:http').IncomingMessage) => string | Promise<string>

    constructor(config: WebSocketServerTransportConfig) {
        super()
        this.setMaxListeners(100)

        this.connections = config.connections ?? new Map()

        this.config = {
            ...config,
            path: config.path ?? DEFAULT_WS_PATH,
            maxPayload: config.maxPayload ?? DEFAULT_MAX_PAYLOAD,
            enablePing: config.enablePing ?? true,
            pingInterval: config.pingInterval ?? DEFAULT_PING_INTERVAL,
            pingTimeout: config.pingTimeout ?? DEFAULT_PING_TIMEOUT,
            connections: this.connections,
        }

        const ServerConstructor = config.ServerConstructor ?? WsServer
        this.wsServer = new ServerConstructor({
            server: this.config.server,
            path: this.config.path,
            maxPayload: this.config.maxPayload,
        })

        this.setupEventHandlers()

        if (this.config.enablePing) {
            this.startPingTimer()
        }
    }

    setAuthenticator(authenticator: (request: import('node:http').IncomingMessage) => string | Promise<string>): void {
        this.authenticator = authenticator
    }

    private setupEventHandlers(): void {
        this.wsServer.on('connection', (socket: WebSocket, request: import('node:http').IncomingMessage) => {
            this.handleConnection(socket, request)
        })

        this.wsServer.on('error', (error: Error) => {
            this.config.logger?.error('WebSocket Server Error:', error)
            this.emit('error', error)
        })
    }

    private async handleConnection(socket: WebSocket, request: import('node:http').IncomingMessage): Promise<void> {
        let clientId: ClientId

        try {
            if (this.authenticator) {
                clientId = (await this.authenticator(request)) as ClientId
            } else if (this.config.generateId) {
                clientId = await this.config.generateId(request)
            } else {
                clientId = generateClientId()
            }
        } catch (error) {
            try {
                socket.close(4001, error instanceof Error ? error.message : 'Unauthorized')
            } catch (e) {
                // Ignore close error
            }
            return
        }

        const connectedAt = Date.now()

        const connection: IClientConnection = {
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
            this.config.logger?.error(`Failed to parse message from ${clientId}:`, error as Error)
            this.emit('error', error as Error)
        }
    }

    private handleDisconnection(clientId: ClientId): void {
        this.emit('disconnection', clientId)
        this.connections.delete(clientId)
    }

    private setupPingPong(clientId: ClientId, socket: WebSocket): void {
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
            const socket = connection.socket
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
