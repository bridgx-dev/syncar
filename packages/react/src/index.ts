import { useState, useEffect, useCallback, useRef } from 'react'
import { useSynnel } from './Provider'
import { MessageType } from '@synnel/core/client'

export * from './Provider'

type UseChannelOptions<T> = {
  onMessage?: (data: T) => void
  onError?: (err: any) => void
}

type UseChannelReturn<T = any> = {
  data: T | null
  send: (data: T) => void
  status: 'connecting' | 'open' | 'closed' | 'closing'
  error: Error | null
  loading: boolean
}

/**
 * React hook to interact with a specific Synnel channel.
 */
const useChannel = <T = any>(
  channelName: string,
  options: UseChannelOptions<T> = {},
): UseChannelReturn<T> => {
  const { client: synnel, status } = useSynnel()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Stable references for callbacks to avoid re-subscription
  const onMessageRef = useRef(options.onMessage)
  const onErrorRef = useRef(options.onError)

  useEffect(() => {
    onMessageRef.current = options.onMessage
    onErrorRef.current = options.onError
  }, [options.onMessage, options.onError])

  useEffect(() => {
    if (!synnel) return

    // Clear state when switching channels
    setData(null)
    setError(null)

    const unsubscribe = synnel
      .subscribe(channelName)
      .onMessage((incomingData: T) => {
        setData(incomingData)
        if (onMessageRef.current) {
          onMessageRef.current(incomingData)
        }
      })
      .onError((err: any) => {
        const errorObject =
          err instanceof Error ? err : new Error(err || 'Unknown channel error')
        setError(errorObject)
        if (onErrorRef.current) {
          onErrorRef.current(errorObject)
        }
      })

    return () => {
      unsubscribe()
    }
  }, [synnel, channelName])

  const send = useCallback(
    (newData: T) => {
      if (!synnel) {
        console.warn(`Synnel: Cannot send data - client not initialized.`)
        return
      }
      synnel.send({
        type: MessageType.DATA,
        channel: channelName,
        data: newData,
      })
      setData(newData) // Optimistic local update
    },
    [synnel, channelName],
  )

  return {
    data,
    send,
    status,
    error,
    loading: status === 'connecting',
  }
}

type UseBroadcastOptions<T> = {
  onMessage?: (data: T) => void
  onError?: (err: any) => void
}

type UseBroadcastReturn<T = any> = {
  data: T | null
  status: 'connecting' | 'open' | 'closed' | 'closing'
  error: Error | null
  loading: boolean
}

/**
 * React hook to listen to the global broadcast channel.
 */
const useBroadcast = <T = any>(
  options: UseBroadcastOptions<T> = {},
): UseBroadcastReturn<T> => {
  const { client: synnel, status } = useSynnel()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const onMessageRef = useRef(options.onMessage)
  const onErrorRef = useRef(options.onError)

  useEffect(() => {
    onMessageRef.current = options.onMessage
    onErrorRef.current = options.onError
  }, [options.onMessage, options.onError])

  useEffect(() => {
    if (!synnel) return

    setData(null)
    setError(null)

    const unsubscribe = synnel
      .subscribe('__broadcast')
      .onMessage((incomingData: T) => {
        setData(incomingData)
        if (onMessageRef.current) {
          onMessageRef.current(incomingData)
        }
      })
      .onError((err: any) => {
        const errorObject =
          err instanceof Error
            ? err
            : new Error(err || 'Unknown broadcast error')
        setError(errorObject)
        if (onErrorRef.current) {
          onErrorRef.current(errorObject)
        }
      })

    return () => {
      unsubscribe()
    }
  }, [synnel])

  return {
    data,
    status,
    error,
    loading: status === 'connecting',
  }
}

export { useChannel, useBroadcast }
