/**
 * Connection Handler
 * Processes new client connections and disconnections.
 *
 * @module handlers/connection-handler
 */

import type {
  IClientRegistry,
  IClientConnection,
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
  private readonly options: Required<ConnectionHandlerOptions>

  constructor(dependencies: {
    registry: IClientRegistry
    options?: ConnectionHandlerOptions
  }) {
    this.registry = dependencies.registry

    // Apply defaults
    this.options = {
      rejectionCloseCode:
        dependencies.options?.rejectionCloseCode ?? CLOSE_CODES.REJECTED,
    }
  }

  /**
   * Handle a new client connection
   *
   * Process flow:
   * 1. Register client in registry (creates IClientConnection)
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
  ): Promise<IClientConnection> {
    // Register client in registry
    const client = this.registry.register(connection)

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

    // Unregister client
    this.registry.unregister(clientId)
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
