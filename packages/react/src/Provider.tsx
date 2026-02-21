import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react'
import { Client, type ClientOptions } from '@synnel/core/client'

export type SynnelProviderProps = {
  children: React.ReactNode
  options: ClientOptions
}

type SynnelContextValue = {
  client: Client | null
  status: 'connecting' | 'open' | 'closed'
}

const SynnelContext = createContext<SynnelContextValue>({
  client: null,
  status: 'connecting',
})

export const SynnelProvider = ({ children, options }: SynnelProviderProps) => {
  const [status, setStatus] =
    useState<SynnelContextValue['status']>('connecting')

  const client = useMemo(() => {
    const defaultId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 11)

    return new Client({
      ...options,
      id: options.id || defaultId,
    })
  }, [JSON.stringify(options)])

  useEffect(() => {
    if (!client) return

    setStatus(client.status)

    const unbind = client.onStatusChange((newStatus) => {
      setStatus(newStatus)
    })

    return () => {
      unbind()
      client.disconnect()
    }
  }, [client])

  return (
    <SynnelContext.Provider value={{ client, status }}>
      {children}
    </SynnelContext.Provider>
  )
}

export const useSynnel = () => {
  const context = useContext(SynnelContext)
  return context
}
