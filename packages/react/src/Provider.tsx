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
  status: 'connecting' | 'open' | 'closed' | 'closing'
}

const SynnelContext = createContext<SynnelContextValue>({
  client: null,
  status: 'connecting',
})

export const SynnelProvider = ({ children, options }: SynnelProviderProps) => {
  const [status, setStatus] =
    useState<SynnelContextValue['status']>('connecting')

  // We use a ref to store the client instance to ensure it remains stable
  // even if the options object is recreated on every render.
  const clientRef = React.useRef<Client | null>(null)
  const disconnectTimerRef = React.useRef<any>(null)

  const client = useMemo(() => {
    // Only create a new client if the URL or ID actually changes
    if (
      !clientRef.current ||
      clientRef.current.options.url !== options.url ||
      clientRef.current.options.id !== options.id
    ) {
      if (clientRef.current) {
        // If options changed, we WANT to disconnect the old client immediately
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current)
          disconnectTimerRef.current = null
        }
        clientRef.current.disconnect()
      }
      clientRef.current = new Client(options)
    }
    return clientRef.current
  }, [options.url, options.id])

  useEffect(() => {
    if (!client) return

    // Clear any pending disconnect from a previous unmount (e.g., Strict Mode)
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current)
      disconnectTimerRef.current = null
    }

    setStatus(client.status)

    const unbind = client.onStatusChange((newStatus) => {
      setStatus(newStatus)
    })

    return () => {
      unbind()
      // Delay disconnect to prevent Strict Mode from killing the connection
      // during the immediate remount.
      disconnectTimerRef.current = setTimeout(() => {
        client.disconnect()
        disconnectTimerRef.current = null
      }, 100)
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
