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

/**
 * WebSocket Server Transport Configuration
 *
 * @remarks
 * Configuration options for the WebSocket transport layer. Extends the
 * standard `ws` library options with Synca-specific settings.
 *
 * @example
 * ```ts
 * const config: WebSocketServerTransportConfig = {
 *   server: httpServer,
 *   path: '/ws',
 *   enablePing: true,
 *   pingInterval: 30000,
 *   pingTimeout: 5000,
 *   maxPayload: 1048576,
 *   connections: new Map(),
 *   generateId: (request) => extractUserId(request),
 *   logger: console
 * }
 * ```
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
     * Custom ID generator for new connections
     *
     * @remarks
     * Function to generate unique client IDs from incoming HTTP requests.
     * Useful for implementing custom authentication or ID generation strategies.
     *
     * @example
     * ```ts
     * generateId: async (request) => {
     *   const token = request.headers.authorization?.split(' ')[1]
     *   return verifyToken(token).then(user => user.id)
     * }
     * ```
     */
    generateId?: IdGenerator

    /**
     * Custom WebSocket Server constructor
     *
     * @remarks
     * Allows using a custom WebSocket server implementation.
     * Defaults to the standard `ws` WebSocketServer.
     */
    ServerConstructor?: new (config: WsServerOptions) => ServerInstance

    /**
     * Logger instance
     *
     * @remarks
     * Optional logger for transport-level logging.
     */
    logger?: ILogger
}

/**
 * WebSocket Server Transport
 *
 * @remarks
 * Handles low-level WebSocket communication using the `ws` library.
 * Manages connections, message parsing, ping/pong keep-alive, and
 * emits high-level events for the server to consume.
 *
 * This transport:
 * - Wraps the `ws` WebSocketServer
 * - Generates unique client IDs
 * - Handles connection lifecycle (connect, disconnect, error)
 * - Parses incoming messages as JSON
 * - Manages ping/pong for connection health
 * - Emits typed events for server consumption
 *
 * @example
 * ### Basic usage
 * ```ts
 * import { WebSocketServerTransport } from '@synca/server'
 *
 * const transport = new WebSocketServerTransport({
 *   server: httpServer,
 *   path: '/ws',
 *   enablePing: true,
 *   pingInterval: 30000,
 *   pingTimeout: 5000
 * })
 *
 * transport.on('connection', (client) => {
 *   console.log(`Client connected: ${client.id}`)
 * })
 *
 * transport.on('message', (clientId, message) => {
 *   console.log(`Message from ${clientId}:`, message)
 * })
 *
 * transport.on('disconnection', (clientId) => {
 *   console.log(`Client disconnected: ${clientId}`)
 * })
 * ```
 *
 * @example
 * ### With custom ID generator
 * ```ts
 * const transport = new WebSocketServerTransport({
 *   server: httpServer,
 *   generateId: async (request) => {
 *     const token = request.headers.authorization?.split(' ')[1]
 *     const user = await verifyJwt(token)
 *     return user.id
 *   }
 * })
 * ```
 *
 * @example
 * ### With shared connections
 * ```ts
 * const sharedConnections = new Map()
 *
 * const transport1 = new WebSocketServerTransport({
 *   connections: sharedConnections
 * })
 *
 * const transport2 = new WebSocketServerTransport({
 *   connections: sharedConnections
 * })
 * ```
 *
 * @see {@link EventEmitter} for event methods (on, off, emit, etc.)
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
    /** @internal */
    private authenticator?: (request: import('node:http').IncomingMessage) => string | Promise<string>

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

    /**
     * Set a custom authentication handler
     *
     * @remarks
     * Sets an authenticator function that receives the HTTP upgrade request
     * and returns a client ID. The authenticator can throw to reject the connection.
     *
     * @param authenticator - Function that receives the HTTP upgrade request
     * and returns a client ID (or throws to reject)
     *
     * @example
     * ```ts
     * transport.setAuthenticator(async (request) => {
     *   const token = request.headers.authorization?.split(' ')[1]
     *   if (!token) {
     *     throw new Error('No token provided')
     *   }
     *   const user = await verifyJwt(token)
     *   return user.id
     * })
     * ```
     */
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
