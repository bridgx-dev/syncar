/**
 * React Integration Types
 * Types for @syncar/react package
 */

import type { SyncarClient, ClientStatus } from '@syncar/client'
import type { ChannelName, DataMessage } from '@syncar/types'
import type { ReactNode } from 'react'

/**
 * Syncar React Context Value
 */
export interface SyncarContextValue {
    /**
     * The Syncar client instance
     */
    client: SyncarClient
}

/**
 * Channel subscription state for useChannel
 */
export interface UseChannelState<T = unknown> {
    /**
     * Current connection status
     */
    status: ClientStatus

    /**
     * Whether the client is connected
     */
    isConnected: boolean

    /**
     * Whether currently connecting
     */
    isConnecting: boolean

    /**
     * Last data received
     */
    data: T | null

    /**
     * Last error
     */
    error: Error | null

    /**
     * Subscription state
     */
    subscriptionState:
        | 'unsubscribed'
        | 'subscribing'
        | 'subscribed'
        | 'unsubscribing'
}

/**
 * Options for useChannel hook
 */
export interface UseChannelOptions<T = unknown> {
    /**
     * Called when a data message is received
     */
    onMessage?: (data: T, message: DataMessage<T>) => void

    /**
     * Called when subscription is confirmed
     */
    onSubscribed?: () => void

    /**
     * Called when unsubscription is confirmed
     */
    onUnsubscribed?: () => void

    /**
     * Called when an error occurs
     */
    onError?: (error: Error) => void

    /**
     * Whether to enable the subscription
     * @default true
     */
    enabled?: boolean
}

/**
 * Return value for useChannel hook
 */
export interface UseChannelReturn<T = unknown> extends UseChannelState<T> {
    /**
     * Send data to the channel
     */
    send: (data: T) => Promise<void>

    /**
     * Unsubscribe from the channel
     */
    unsubscribe: () => Promise<void>

    /**
     * Re-subscribe to the channel
     */
    resubscribe: () => Promise<void>

    /**
     * Register a message handler
     * @param handler - Function to call when a message is received
     * @returns Unsubscribe function
     */
    onMessage: (
        handler: (data: T, message: DataMessage<T>) => void,
    ) => () => void
}

/**
 * Options for useBroadcast hook
 */
export interface UseBroadcastOptions<T = unknown> {
    /**
     * Called when a broadcast message is received
     */
    onMessage?: (data: T, message: DataMessage<T>) => void

    /**
     * Called when an error occurs
     */
    onError?: (error: Error) => void

    /**
     * Whether to enable listening for broadcasts
     * @default true
     */
    enabled?: boolean
}

/**
 * Return value for useBroadcast hook
 */
export interface UseBroadcastReturn<T = unknown> {
    /**
     * Current connection status
     */
    status: ClientStatus

    /**
     * Whether the client is connected
     */
    isConnected: boolean

    /**
     * Last data received
     */
    data: T | null

    /**
     * Last error
     */
    error: Error | null

    /**
     * Broadcast data to all connected clients
     */
    broadcast: (data: T) => Promise<void>
    /**
     * Register a message handler
     * @param handler - Function to call when a message is received
     * @returns Unsubscribe function
     */
    onMessage: (
        handler: (data: T, message: DataMessage<T>) => void,
    ) => () => void
}

/**
 * Options for SyncarProvider
 */
export interface SyncarProviderProps {
    /**
     * The Syncar client instance
     */
    client: SyncarClient

    /**
     * React children
     */
    children: ReactNode
}

/**
 * Error thrown when hooks are used outside of SyncarProvider
 */
export class MissingProviderError extends Error {
    constructor() {
        super(
            'Syncar hooks must be used within a SyncarProvider. ' +
                'Wrap your component tree with <SyncarProvider client={client}>.',
        )
        this.name = 'MissingProviderError'
    }
}
