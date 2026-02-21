import { useState, useEffect, useCallback, useMemo } from 'react'
import { Channel } from '@tunnel/core'
import { useTunnelContext } from './Provider'

export * from './Provider'

type UseChannelReturn<T = any> = {
  data: T | null
  send: (data: T) => void
  error: Error | null
  loading: boolean
}

/**
 * React hook to interact with a specific Tunnel channel.
 */
const useChannel = <T = any>(
  nameOrChannel: string | Channel<T>,
): UseChannelReturn<T> => {
  const tunnel = useTunnelContext()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Memoize the Channel instance
  const channel = useMemo(() => {
    if (!tunnel) return null

    if (typeof nameOrChannel === 'string') {
      return tunnel.createChannel<T>(nameOrChannel)
    } else {
      // If it's a shared Channel instance, bind the tunnel to it if not already bound
      nameOrChannel.bind(tunnel)
      return nameOrChannel
    }
  }, [tunnel, nameOrChannel])

  useEffect(() => {
    if (!channel) return

    try {
      const unsubscribe = channel.receive((receivedData) => {
        setData(receivedData)
      })
      return () => unsubscribe()
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [channel])

  const send = useCallback(
    (newData: T) => {
      if (!channel) {
        console.warn(`Tunnel: Cannot send data - tunnel not initialized.`)
        return
      }
      channel.send(newData)
      setData(newData) // Optimistic local update
    },
    [channel],
  )

  return {
    data,
    send,
    error,
    loading: !tunnel,
  }
}

export { useChannel }
