/**
 * useBroadcast Hook
 *
 * Hook for broadcasting data to all connected clients.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSyncarClient } from './use-client.js'
import type { UseBroadcastOptions, UseBroadcastReturn } from './types.js'
import type { Message, DataMessage } from '@syncar/types'

/**
 * Broadcast channel name (special reserved channel)
 */
const BROADCAST_CHANNEL = '__broadcast__'

/**
 * Hook for broadcasting data to all connected clients
 *
 * This hook uses a special broadcast channel to send data that all connected
 * clients will receive. Unlike regular channels which require subscription,
 * broadcasts are received by all connected clients automatically.
 *
 * @param options - Optional callbacks and configuration
 * @returns Broadcast state and methods
 *
 * @example
 * ```tsx
 * interface CursorPosition {
 *   x: number
 *   y: number
 * }
 *
 * function MouseTracker() {
 *   const { data, broadcast, isConnected } = useBroadcast<CursorPosition>({
 *     onMessage: (pos) => {
 *       console.log('User moved cursor to:', pos.x, pos.y)
 *     },
 *   })
 *
 *   useEffect(() => {
 *     const handleMouseMove = (e: MouseEvent) => {
 *       broadcast({ x: e.clientX, y: e.clientY })
 *     }
 *
 *     window.addEventListener('mousemove', handleMouseMove)
 *     return () => window.removeEventListener('mousemove', handleMouseMove)
 *   }, [broadcast])
 *
 *   return (
 *     <div>
 *       <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
 *       {data && <div>Remote cursor at: {data.x}, {data.y}</div>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useBroadcast<T = unknown>(
  options?: UseBroadcastOptions<T>,
): UseBroadcastReturn<T> {
  const client = useSyncarClient()
  const enabled = options?.enabled ?? true

  // State for broadcast data and error
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Refs to store mounted state and callbacks
  const mountedRef = useRef(true)
  const onMessageRef = useRef(options?.onMessage)
  const onErrorRef = useRef(options?.onError)

  // Update callback refs when options change
  useEffect(() => {
    onMessageRef.current = options?.onMessage
    onErrorRef.current = options?.onError
  }, [options])

  // Listen for broadcast messages
  useEffect(() => {
    if (!enabled) {
      return
    }

    mountedRef.current = true

    // Subscribe to broadcast messages
    const unsubscribe = client.on('message', (message: Message) => {
      if (!mountedRef.current) return

      // Filter for broadcast data messages
      if (message.type === 'data' && message.channel === BROADCAST_CHANNEL) {
        const dataMessage = message as DataMessage<T>
        const newData = dataMessage.data

        // Update state
        setData(newData)
        setError(null)

        // Call callback
        if (onMessageRef.current) {
          onMessageRef.current(newData, dataMessage)
        }
      }
    })

    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [client, enabled])

  // Broadcast data to all clients
  const broadcast = useCallback(
    async (data: T) => {
      if (!enabled) return

      try {
        await client.publish(BROADCAST_CHANNEL, data)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        setError(err)

        if (onErrorRef.current) {
          onErrorRef.current(err)
        }
      }
    },
    [client, enabled],
  )

  // Register a message handler
  const onMessage = useCallback(
    (handler: (data: T, message: DataMessage<T>) => void) => {
      return client.on('message', (message: Message) => {
        if (message.type === 'data' && message.channel === BROADCAST_CHANNEL) {
          const dataMessage = message as DataMessage<T>
          handler(dataMessage.data, dataMessage)
        }
      })
    },
    [client],
  )

  return {
    status: client.status,
    isConnected: client.status === 'connected',
    data,
    error,
    broadcast,
    onMessage,
  }
}
