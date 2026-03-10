/**
 * @syncar/react
 *
 * React integration for Syncar v2 - Real-time synchronization with hooks
 */

// Export provider and context
export { SyncarProvider } from './Provider.js'
export { SyncarContext, useSyncarContext } from './context.js'

// Export hooks
export { useSyncarClient } from './use-client.js'
export { useChannel } from './use-channel.js'
export { useBroadcast } from './use-broadcast.js'

// Export types
export type {
    SyncarContextValue,
    UseChannelState,
    UseChannelOptions,
    UseChannelReturn,
    UseBroadcastOptions,
    UseBroadcastReturn,
    SyncarProviderProps,
    MissingProviderError,
} from './types.js'

// Re-export client types for convenience
export type {
    SyncarClient,
    ClientStatus,
    ChannelSubscription,
    SubscriptionState,
    ChannelName,
} from '@syncar/client'
