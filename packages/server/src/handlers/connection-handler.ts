/**
 * Connection Handler
 * Processes new client connections and disconnections.
 *
 * @module handlers/connection-handler
 */

import type {
  IClientRegistry,
  IServerClient,
  IClientConnection,
  IMiddlewareManager,
  IEventEmitter,
  IServerEventMap,
  IServerTransport,
} from '../types'
import { CLOSE_CODES } from '../config'

// ============================================================
// CONNECTION HANDLER OPTIONS
// ============================================================

/**
 * Connection handler options
 *
 * @example
 * ```ts
 * const options: ConnectionHandlerOptions = {
 *   emitConnectionEvent: true,
 *   emitDisconnectionEvent: true
 * }
 * ```
 */
export interface ConnectionHandlerOptions {
  /**
   * Whether to emit connection events
   * @default true
   */
  emitConnectionEvent?: boolean

  /**
   * Whether to emit disconnection events
   * @default true
   */
  emitDisconnectionEvent?: boolean

  /**
   * Close code to use when middleware rejects connection
   * @default CLOSE_CODES.REJECTED
   */
  rejectionCloseCode?: number
}

// ============================================================
// CONNECTION HANDLER CLASS
// ============================================================

/**
 * Connection Handler
 * Processes new client connections and disconnections.
 *
 * This handler:
 * 1. Executes connection middleware
 * 2. Registers client in registry
 * 3. Emits connection event
 * 4. Handles disconnections with cleanup
 *
 * @example
 * ```ts
 * import { ConnectionHandler } from '@synnel/server/handlers'
 *
 * const connectionHandler = new ConnectionHandler({
 *   registry: clientRegistry,
 *   middleware: middlewareManager,
 *   emitter: eventEmitter
 * })
 *
 * // Handle new connection
 * await connectionHandler.handleConnection(clientConnection)
 *
 * // Handle disconnection
 * await connectionHandler.handleDisconnection(clientId)
 * ```
 */
export class ConnectionHandler {
  private readonly registry: IClientRegistry
  private readonly middleware: IMiddlewareManager
  private readonly emitter: IEventEmitter<IServerEventMap>
  private readonly transport: IServerTransport
  private readonly options: Required<ConnectionHandlerOptions>

  /**
   * Create a new connection handler
   *
   * @param dependencies - Handler dependencies
   *
   * @example
   * ```ts
   * const handler = new ConnectionHandler({
   *   registry: clientRegistry,
   *   middleware: middlewareManager,
   *   emitter: eventEmitter,
   *   transport: serverTransport
   * })
   * ```
   */
  constructor(dependencies: {
    registry: IClientRegistry
    middleware: IMiddlewareManager
    emitter: IEventEmitter<IServerEventMap>
    transport: IServerTransport
    options?: ConnectionHandlerOptions
  }) {
    this.registry = dependencies.registry
    this.middleware = dependencies.middleware
    this.emitter = dependencies.emitter
    this.transport = dependencies.transport

    // Apply defaults
    this.options = {
      emitConnectionEvent: dependencies.options?.emitConnectionEvent ?? true,
      emitDisconnectionEvent:
        dependencies.options?.emitDisconnectionEvent ?? true,
      rejectionCloseCode:
        dependencies.options?.rejectionCloseCode ?? CLOSE_CODES.REJECTED,
    }
  }

  /**
   * Handle a new client connection
   *
   * Process flow:
   * 1. Register client in registry (creates IServerClient wrapper)
   * 2. Execute connection middleware
   * 3. If middleware rejects, unregister and disconnect
   * 4. Emit connection event
   *
   * @param connection - The client connection
   * @returns The registered server client
   * @throws Error if middleware rejects or registration fails
   *
   * @example
   * ```ts
   * try {
   *   const client = await connectionHandler.handleConnection(clientConnection)
   *   console.log(`Client connected: ${client.id}`)
   * } catch (error) {
   *   console.log('Connection rejected:', error.message)
   * }
   * ```
   */
  async handleConnection(
    connection: IClientConnection,
  ): Promise<IServerClient> {
    // Register client in registry first (creates IServerClient wrapper)
    const client = this.registry.register(connection, this.transport)

    // Execute connection middleware
    try {
      await this.middleware.executeConnection(client, 'connect')
    } catch {
      // Middleware rejected - unregister and disconnect
      this.registry.unregister(connection.id)
      connection.socket.close(
        this.options.rejectionCloseCode,
        'Connection rejected',
      )
      throw new Error('Connection rejected by middleware')
    }

    // Emit connection event
    if (this.options.emitConnectionEvent) {
      this.emitter.emit('connection', client)
    }

    return client
  }

  /**
   * Handle a client disconnection
   *
   * Process flow:
   * 1. Execute disconnect middleware
   * 2. Emit disconnection event (client still in registry)
   * 3. Unregister client from registry
   *
   * @param clientId - The client ID to disconnect
   * @param reason - Optional disconnection reason
   *
   * @example
   * ```ts
   * await connectionHandler.handleDisconnection('client-123', 'Client disconnected')
   * ```
   */
  async handleDisconnection(clientId: string, _reason?: string): Promise<void> {
    const client = this.registry.get(clientId)

    if (!client) {
      return // Client already unregistered
    }

    // Execute disconnect middleware
    try {
      await this.middleware.executeConnection(client, 'disconnect')
    } catch {
      // Ignore middleware errors during disconnection
    }

    // Unregister client from registry FIRST
    // This ensures that getStats() returns the correct count in event handlers
    this.registry.unregister(clientId)

    // Emit disconnection event AFTER unregistering
    if (this.options.emitDisconnectionEvent) {
      this.emitter.emit('disconnection', client)
    }
  }

  /**
   * Get handler options
   *
   * @returns Current handler options
   *
   * @example
   * ```ts
   * const options = connectionHandler.getOptions()
   * console.log('Emit events:', options.emitConnectionEvent)
   * ```
   */
  getOptions(): Readonly<Required<ConnectionHandlerOptions>> {
    return this.options
  }
}
