/**
 * React Integration Types
 * Types for @synnel/react package
 */

import type { SynnelClient, ClientStatus } from '@synnel/client'
import type { ChannelName, DataMessage } from '@synnel/types'
import type { ReactNode } from 'react'

/**
 * Synnel React Context Value
 */
export interface SynnelContextValue {
  /**
   * The Synnel client instance
   */
  client: SynnelClient
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
  onMessage: (handler: (data: T, message: DataMessage<T>) => void) => () => void
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
  onMessage: (handler: (data: T, message: DataMessage<T>) => void) => () => void
}

/**
 * Options for SynnelProvider
 */
export interface SynnelProviderProps {
  /**
   * The Synnel client instance
   */
  client: SynnelClient

  /**
   * React children
   */
  children: ReactNode
}

/**
 * Error thrown when hooks are used outside of SynnelProvider
 */
export class MissingProviderError extends Error {
  constructor() {
    super(
      'Synnel hooks must be used within a SynnelProvider. ' +
        'Wrap your component tree with <SynnelProvider client={client}>.',
    )
    this.name = 'MissingProviderError'
  }
}
