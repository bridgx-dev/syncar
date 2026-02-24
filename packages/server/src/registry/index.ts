/**
 * Registry Module
 * Client registry for managing connected clients and their subscriptions.
 *
 * @module registry
 */

// ============================================================
// CLIENT REGISTRY
// ============================================================

export { ClientRegistry } from './client-registry.js'

// ============================================================
// CLIENT FACTORY
// ============================================================

export {
  ServerClientFactory,
  defaultClientFactory,
} from './client-factory.js'

// ============================================================
// RE-EXPORT TYPES
// ============================================================

export type {
  IClientData,
  IServerClient,
  IClientRegistry,
  IServerClientFactory,
  IClientWithMetadata,
  IDisconnectionEvent,
} from '../types/client.js'

export type {
  IClientConnection,
} from '../types/base.js'

export type {
  ClientId,
  ChannelName,
  Message,
} from '@synnel/types'
