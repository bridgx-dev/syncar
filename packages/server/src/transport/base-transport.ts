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

}
