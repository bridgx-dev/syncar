/**
 * Base Transport
 * Abstract base class for transport implementations.
 *
 * @module transport/base-transport
 */

import { EventEmitter } from 'node:events'
import type {
  IBaseTransport,
  IClientConnection,
  ClientId,
  Message,
} from '../types'

// ============================================================
// BASE TRANSPORT CLASS
// ============================================================

/**
 * Abstract base transport class
 * Provides common functionality for all transport implementations.
 *
 * Transport implementations extend this class to handle WebSocket
 * communication with clients.
 *
 * @example
 * ```ts
 * import { BaseTransport } from '@synnel/server/transport'
 *
 * class MyTransport extends BaseTransport {
 *   async sendToClient(clientId, message) {
 *     // Implementation...
 *   }
 * }
 * ```
 */
export abstract class BaseTransport
  extends EventEmitter
  implements IBaseTransport
{
  /**
   * Map of connected clients by ID
   * Public readonly as required by IBaseTransport interface
   * Subclasses can access this directly to manage connections
   */
  public readonly connections: Map<ClientId, IClientConnection>

  /**
   * Set max listeners to a higher default for transport use cases
   * Transports may have many event listeners registered
   */
  constructor(connections: Map<ClientId, IClientConnection> = new Map()) {
    super()
    this.connections = connections
    this.setMaxListeners(100)
  }

  /**
   * Send a message to a specific client
   *
   * @param clientId - The target client ID
   * @param message - The message to send
   * @throws Error if client not found or not connected
   *
   * @example
   * ```ts
   * await transport.sendToClient('client-123', {
   *   type: 'data',
   *   data: 'Hello!'
   * })
   * ```
   */
  abstract sendToClient(clientId: ClientId, message: Message): Promise<void>

  /**
   * Get all connected clients
   *
   * @returns Array of all client connections
   */
  getClients(): IClientConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get a specific client by ID
   *
   * @param clientId - The client ID to look up
   * @returns The client connection or undefined if not found
   */
  getClient(clientId: ClientId): IClientConnection | undefined {
    return this.connections.get(clientId)
  }

  /**
   * Get the number of connected clients
   *
   * @returns Client count
   */
  getClientCount(): number {
    return this.connections.size
  }

  /**
   * Disconnect a specific client
   *
   * @param clientId - The client to disconnect
   * @param code - WebSocket close code (default: 1000)
   * @param reason - Close reason string
   * @returns true if client was disconnected, false if not found
   */
  disconnectClient(
    clientId: ClientId,
    code: number = 1000,
    reason?: string,
  ): boolean {
    const client = this.connections.get(clientId)
    if (!client) return false

    try {
      client.socket.close(code, reason)
      return true
    } catch {
      return false
    }
  }

  /**
   * Disconnect all connected clients
   *
   * @param code - WebSocket close code (default: 1000)
   * @param reason - Close reason string
   */
  disconnectAll(code: number = 1000, reason?: string): void {
    for (const client of this.connections.values()) {
      try {
        client.socket.close(code, reason)
      } catch {
        // Ignore errors during shutdown
      }
    }
  }
}
