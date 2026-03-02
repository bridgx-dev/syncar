/**
 * useChannel Hook
 *
 * Hook for subscribing to a channel and receiving messages.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSynnelClient } from './use-client.js'
import type { ChannelSubscription } from '@synnel/client'
import type { UseChannelOptions, UseChannelReturn } from './types.js'
import type { DataMessage } from '@synnel/types'

/**
 * Hook for subscribing to a channel
 *
 * @param channel - The channel name to subscribe to
 * @param options - Optional callbacks and configuration
 * @returns Channel state and methods
 *
 * @example
 * ```tsx
 * interface ChatMessage {
 *   id: string
 *   text: string
 *   user: string
 * }
 *
 * function ChatRoom() {
 *   const { data, send, isConnected, status } = useChannel<ChatMessage>('chat', {
 *     onMessage: (msg) => console.log('New message:', msg),
 *     onError: (err) => console.error('Error:', err),
 *   })
 *
 *   if (status === 'connecting') {
 *     return <div>Connecting...</div>
 *   }
 *
 *   return (
 *     <div>
 *       <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
 *       <button onClick={() => send({ text: 'Hello', user: 'Me' })}>
 *         Send Message
 *       </button>
 *       {data && <div>Last message: {data.text}</div>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChannel<T = unknown>(
  channel: string,
  options?: UseChannelOptions<T>,
): UseChannelReturn<T> {
  const client = useSynnelClient()
  const enabled = options?.enabled ?? true

  // State for channel data, error, and subscription state
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [subscriptionState, setSubscriptionState] = useState<
    'unsubscribed' | 'subscribing' | 'subscribed' | 'unsubscribing'
  >('unsubscribed')

  // Refs to store mounted state and callbacks
  const subscriptionRef = useRef<ChannelSubscription<T> | undefined>(undefined)
  const mountedRef = useRef(true)
  const onMessageRef = useRef(options?.onMessage)
  const onSubscribedRef = useRef(options?.onSubscribed)
  const onUnsubscribedRef = useRef(options?.onUnsubscribed)
  const onErrorRef = useRef(options?.onError)

  // Update callback refs when options change
  useEffect(() => {
    onMessageRef.current = options?.onMessage
    onSubscribedRef.current = options?.onSubscribed
    onUnsubscribedRef.current = options?.onUnsubscribed
    onErrorRef.current = options?.onError
  }, [options])

  // Subscribe to channel
  useEffect(() => {
    if (!enabled) {
      setSubscriptionState('unsubscribed')
      return
    }

    mountedRef.current = true

    const setupSubscription = async () => {
      if (!mountedRef.current) {
        return
      }

      try {
        // Get or create subscription
        const currentSubscription = subscriptionRef.current

        if (!currentSubscription || currentSubscription.channel !== channel) {
          // Clean up old subscription if channel changed
          if (
            subscriptionRef.current &&
            subscriptionRef.current.channel !== channel
          ) {
            await subscriptionRef.current.unsubscribe()
            subscriptionRef.current = undefined
          }

          // Create new subscription with callbacks
          const newSubscription = await client.subscribe<T>(channel, {
            onMessage: (message: DataMessage<T>) => {
              if (!mountedRef.current) return

              // Update state
              setData(message.data)
              setError(null)

              // Call callback
              if (onMessageRef.current) {
                onMessageRef.current(message.data, message)
              }
            },
            onSubscribed: () => {
              if (!mountedRef.current) return

              // Update state
              setSubscriptionState('subscribed')

              // Call callback
              if (onSubscribedRef.current) {
                onSubscribedRef.current()
              }
            },
            onUnsubscribed: () => {
              if (!mountedRef.current) return

              // Update state
              setSubscriptionState('unsubscribed')

              // Call callback
              if (onUnsubscribedRef.current) {
                onUnsubscribedRef.current()
              }
            },
            onError: (error: Error) => {
              if (!mountedRef.current) return

              // Update state
              setError(error)

              // Call callback
              if (onErrorRef.current) {
                onErrorRef.current(error)
              }
            },
          })

          subscriptionRef.current = newSubscription
          setSubscriptionState(newSubscription.state)
        }
      } catch (error) {
        if (!mountedRef.current) return

        const err = error instanceof Error ? error : new Error(String(error))
        setError(err)

        if (onErrorRef.current) {
          onErrorRef.current(err)
        }
      }
    }

    setupSubscription()

    // Cleanup on unmount or channel change
    return () => {
      mountedRef.current = false

      // Don't unsubscribe on unmount if autoResubscribe is enabled
      // The subscription will be reused on remount
    }
  }, [channel, client, enabled])

  // Send data to channel
  const send = useCallback(
    async (data: T) => {
      await client.publish(channel, data)
    },
    [client, channel],
  )

  // Unsubscribe from channel
  const unsubscribe = useCallback(async () => {
    if (subscriptionRef.current) {
      await subscriptionRef.current.unsubscribe()
      setSubscriptionState('unsubscribed')
    }
  }, [])

  // Re-subscribe to channel
  const resubscribe = useCallback(async () => {
    if (subscriptionRef.current) {
      await subscriptionRef.current.subscribe()
    }
  }, [])

  // Register a message handler
  const onMessage = useCallback(
    (handler: (data: T, message: DataMessage<T>) => void) => {
      if (!subscriptionRef.current) {
        // If not subscribed yet, this might be tricky.
        // But the example uses it in useEffect which should be fine after initial mount.
        // For simplicity, we'll try to use the subscription if it exists.
        console.warn('onMessage called before subscription was established')
        return () => {}
      }

      return subscriptionRef.current.onMessage((msg) => {
        handler(msg.data, msg)
      })
    },
    [],
  )

  return {
    status: client.status,
    isConnected: client.status === 'connected',
    isConnecting:
      client.status === 'connecting' || client.status === 'reconnecting',
    data,
    error,
    subscriptionState,
    send,
    unsubscribe,
    resubscribe,
    onMessage,
  }
}
