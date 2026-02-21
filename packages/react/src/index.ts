import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSynnel } from './Provider'
import { MessageType } from '@synnel/core'

export * from './Provider'

type UseChannelReturn<T = any> = {
  data: T | null
  send: (data: T) => void
  status: 'connecting' | 'open' | 'closed'
  error: Error | null
  loading: boolean
}

/**
 * React hook to interact with a specific Synnel channel.
 */
const useChannel = <T = any>(channelName: string): UseChannelReturn<T> => {
  const { client: synnel, status } = useSynnel()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!synnel) return

    const unsubscribe = synnel
      .subscribe(channelName)
      .onMessage((incomingData: T) => {
        setData(incomingData)
      })
      .onError((err: any) => {
        setError(
          err instanceof Error
            ? err
            : new Error(err || 'Unknown channel error'),
        )
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

export { useChannel }
