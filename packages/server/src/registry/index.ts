/**
 * Registry Module
 * Client registry for managing connected clients and their subscriptions.
 *
 * @module registry
 */

export { ClientRegistry } from './client-registry'

// State types and utilities
export type { RegistryState } from './state'
export {
  createEmptyState,
  createChannel,
  deleteChannel,
  getChannelSubscriberCount,
  getTotalSubscriptionCount,
  isSubscribed,
  getChannelSubscribers,
  getClientChannels,
} from './state'

// Handler registry
export { HandlerRegistry } from './handler-registry'
export type { HandlerRegistryState } from './handler-registry'
