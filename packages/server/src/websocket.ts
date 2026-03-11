import { EventEmitter } from 'node:events'
import { IncomingMessage } from 'node:http'
import {
    WebSocketServer as WsServer,
    type ServerOptions as WsServerOptions,
    type WebSocket,
} from 'ws'
import {
    MessageType,
    SignalType,
    type ClientId,
    type IClientConnection,
} from './types'
import {
    DEFAULT_MAX_PAYLOAD,
    DEFAULT_PING_INTERVAL,
    DEFAULT_PING_TIMEOUT,
    DEFAULT_PATH,
} from './config'
import { generateClientId } from './utils'

// Instance types
type ServerInstance = WsServer

/**
 * WebSocket Server Transport Configuration
 */
export interface WebSocketServerTransportConfig extends WsServerOptions {
    /**
     * Enable client ping/pong
     *
     * @remarks
     * When enabled, the server sends periodic ping frames to detect
     * dead connections and maintain keep-alive.
     *
     * @default true
     */
    enablePing?: boolean

    /**
     * Ping interval in milliseconds
     *
     * @remarks
     * Time between ping frames when `enablePing` is true.
     *
     * @default 30000 (30 seconds)
     */
    pingInterval?: number

    /**
     * Ping timeout in milliseconds
     *
     * @remarks
     * Time to wait for pong response before closing connection.
     *
     * @default 5000 (5 seconds)
     */
    pingTimeout?: number

    /**
     * Shared connection map
     *
     * @remarks
     * Optional map for sharing connections across multiple server instances.
     * If not provided, a new map will be created.
     */
    connections?: Map<ClientId, IClientConnection>

    /**
     * Custom WebSocket Server constructor
     *
     * @remarks
     * Allows using a custom WebSocket server implementation.
     * Defaults to the standard `ws` WebSocketServer.
     */
    ServerConstructor?: new (config: WsServerOptions) => ServerInstance
}

/**
 * WebSocket Server Transport
 *
 * @example
 * ```ts
 * const transport = new WebSocketServerTransport({ server: httpServer, path: '/ws' })
 * transport.on('connection', (client) => console.log(client.id))
 * ```
 */
export class WebSocketServerTransport extends EventEmitter {
    /**
     * Map of connected clients by ID
     *
     * @remarks
     * Public map of all active connections. Can be used to look up clients
     * by ID or iterate over all connections.
     */
    public readonly connections: Map<ClientId, IClientConnection>

    /** @internal */
    private readonly wsServer: ServerInstance
    /** @internal */
    private readonly config: WebSocketServerTransportConfig & {
        pingInterval: number
        pingTimeout: number
        enablePing: boolean
    }
    /** @internal */
    private pingTimer?: ReturnType<typeof setInterval>

    /**
     * Creates a new WebSocket Server Transport instance
     *
     * @remarks
     * Initializes the WebSocket transport layer with the provided configuration.
     * Sets up the underlying WebSocketServer, configures ping/pong, and
     * establishes event handlers.
     *
     * @param config - Transport configuration options
     *
     * @example
     * ```ts
     * const transport = new WebSocketServerTransport({
     *   server: httpServer,
     *   path: '/ws',
     *   enablePing: true,
     *   pingInterval: 30000,
     *   pingTimeout: 5000
     * })
     * ```
     *
     * @emits connection When a new client connects
     * @emits disconnection When a client disconnects
     * @emits message When a message is received from a client
     * @emits error When an error occurs
     */
    constructor(config: WebSocketServerTransportConfig) {
        super()
        this.setMaxListeners(100)

        this.connections = config.connections ?? new Map()

        this.config = {
            ...config,
            path: config.path ?? DEFAULT_PATH,
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

    private setupEventHandlers(): void {
        this.wsServer.on(
            'connection',
            (
                socket: WebSocket,
                request: import('node:http').IncomingMessage,
            ) => {
                this.handleConnection(socket, request)
            },
        )

        this.wsServer.on('error', (error: Error) => {
            this.emit('error', error)
        })
    }

    private async handleConnection(
        socket: WebSocket,
        request: IncomingMessage,
    ): Promise<void> {
        let clientId = generateClientId()
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
        this.emit('connection', connection, request)
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
            if (
                now - lastPing >
                this.config.pingInterval + this.config.pingTimeout
            ) {
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
