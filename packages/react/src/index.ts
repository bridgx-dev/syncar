/**
 * @synca/react
 *
 * React integration for Synnel v2 - Real-time synchronization with hooks
 */

// Export provider and context
export { SynnelProvider } from './Provider.js'
export { SynnelContext, useSynnelContext } from './context.js'

// Export hooks
export { useSynnelClient } from './use-client.js'
export { useChannel } from './use-channel.js'
export { useBroadcast } from './use-broadcast.js'

// Export types
export type {
  SynnelContextValue,
  UseChannelState,
  UseChannelOptions,
  UseChannelReturn,
  UseBroadcastOptions,
  UseBroadcastReturn,
  SynnelProviderProps,
  MissingProviderError,
} from './types.js'

// Re-export client types for convenience
export type {
  SynnelClient,
  ClientStatus,
  ChannelSubscription,
  SubscriptionState,
  ChannelName,
} from '@synca/client'
