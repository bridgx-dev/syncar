/**
 * Server Client Factory
 * Creates IServerClient wrappers from IClientData and IClientConnection.
 *
 * Provides efficient client wrapper creation with optional caching
 * to avoid creating new wrapper objects for the same client data.
 *
 * @module registry/client-factory
 */

import type {
  IServerClientFactory,
  IClientData,
  IServerClient,
} from '../types/client.js'
import type { IClientConnection } from '../types/base.js'
import type {
  ClientId,
  ChannelName,
  Message,
} from '@synnel/types'

// ============================================================
// SERVER CLIENT FACTORY CLASS
// ============================================================

/**
 * Server Client Factory - creates IServerClient wrappers
 *
 * This factory creates server client wrappers that combine:
 * - Connection data (id, connectedAt, lastPingAt, socket) from IClientConnection
 * - Server methods (send, disconnect, getSubscriptions, hasSubscription)
 *
 * The factory can optionally cache wrappers by ClientId for efficiency.
 *
 * @example
 * ```ts
 * import { ServerClientFactory } from '@synnel/server/registry'
 *
 * const factory = new ServerClientFactory({ cache: true })
 * const client = factory.createClient(clientData, connection)
 * ```
 */
export class ServerClientFactory implements IServerClientFactory {
  /**
   * Optional cache for client wrappers
   * Keyed by ClientId for O(1) lookup
   */
  protected readonly cache: Map<ClientId, IServerClient> = new Map()

  /**
   * Whether caching is enabled
   */
  protected readonly cacheEnabled: boolean

  /**
   * Create a new ServerClientFactory
   *
   * @param options - Factory options
   *
   * @example
   * ```ts
   * // With caching enabled (recommended for production)
   * const factory = new ServerClientFactory({ cache: true })
   *
   * // Without caching (useful for testing)
   * const factory = new ServerClientFactory({ cache: false })
   * ```
   */
  constructor(options: { cache?: boolean } = {}) {
    this.cacheEnabled = options.cache ?? false
  }

  /**
   * Create a server client wrapper
   *
   * Combines IClientConnection properties with server-side methods.
   * The wrapper's methods capture references to clientData for efficient operation.
   *
   * @param clientData - Internal client data
   * @param connection - The connection object
   * @returns Server client wrapper
   *
   * @example
   * ```ts
   * const client = factory.createClient(clientData, connection)
   * await client.send({ type: 'data', data: 'Hello!' })
   * ```
   */
  createClient(
    clientData: IClientData,
    connection: IClientConnection,
  ): IServerClient {
    // Check cache if enabled
    if (this.cacheEnabled) {
      const cached = this.cache.get(clientData.id)
      if (cached) {
        return cached
      }
    }

    // Create new client wrapper
    const serverClient = this.createServerClientWrapper(clientData, connection)

    // Cache if enabled
    if (this.cacheEnabled) {
      this.cache.set(clientData.id, serverClient)
    }

    return serverClient
  }

  /**
   * Create the actual server client wrapper
   *
   * Protected method that creates the wrapper object.
   * Separated from createClient to allow caching logic.
   *
   * @param clientData - Internal client data
   * @param connection - The connection object
   * @returns Server client wrapper
   */
  protected createServerClientWrapper(
    clientData: IClientData,
    connection: IClientConnection,
  ): IServerClient {
    return {
      // IClientConnection properties (readonly)
      id: connection.id,
      connectedAt: connection.connectedAt,
      lastPingAt: connection.lastPingAt,
      socket: connection.socket,

      // IServerClient methods
      send: async (message: Message): Promise<void> => {
        await clientData.transport.sendToClient(clientData.id, message)
      },

      disconnect: async (code?: number, reason?: string): Promise<void> => {
        const conn = clientData.transport.connections.get(clientData.id)
        if (conn?.socket) {
          const socket = conn.socket as unknown as { close: (code: number, reason?: string) => void }
          socket.close(code ?? 1000, reason ?? 'Disconnected')
        }
      },

      getSubscriptions: (): ChannelName[] => {
        return Array.from(clientData.subscriptions)
      },

      hasSubscription: (channel: ChannelName): boolean => {
        return clientData.subscriptions.has(channel)
      },
    }
  }

  /**
   * Clear the client cache
   *
   * Useful for testing or when clients are disconnected.
   *
   * @example
   * ```ts
   * factory.clearCache()
   * ```
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Remove a specific client from the cache
   *
   * @param clientId - Client ID to remove from cache
   * @returns true if client was in cache, false otherwise
   *
   * @example
   * ```ts
   * factory.removeFromCache('client-123')
   * ```
   */
  removeFromCache(clientId: ClientId): boolean {
    return this.cache.delete(clientId)
  }

  /**
   * Get the cache size
   *
   * @returns Number of cached clients
   *
   * @example
   * ```ts
   * console.log(`Cached clients: ${factory.getCacheSize()}`)
   * ```
   */
  getCacheSize(): number {
    return this.cache.size
  }
}

// ============================================================
// DEFAULT FACTORY INSTANCE
// ============================================================

/**
 * Default shared factory instance with caching enabled
 * Use this for most cases to avoid creating multiple factory instances
 *
 * @example
 * ```ts
 * import { defaultClientFactory } from '@synnel/server/registry'
 *
 * const client = defaultClientFactory.createClient(clientData, connection)
 * ```
 */
export const defaultClientFactory = new ServerClientFactory({ cache: true })

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IServerClientFactory,
  IClientData,
  IServerClient,
} from '../types/client.js'

export type { IClientConnection } from '../types/base.js'

export type {
  ClientId,
  ChannelName,
  Message,
} from '@synnel/types'
