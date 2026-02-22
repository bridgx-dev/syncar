/**
 * useSynnelClient Hook
 *
 * Hook to access the Synnel client instance from context.
 */

import { useSyncExternalStore } from 'react'
import { useSynnelContext } from './context.js'
import type { SynnelClient } from '@synnel/client-v2'

/**
 * Subscribe to client state changes
 */
function subscribeToClient(
  client: SynnelClient,
  callback: () => void,
): () => void {
  // Subscribe to all relevant client events
  const unsubscribes = [
    client.on('connecting', callback),
    client.on('connected', callback),
    client.on('disconnected', callback),
    client.on('reconnecting', callback),
  ]

  // Return cleanup function
  return () => {
    for (const unsub of unsubscribes) {
      unsub()
    }
  }
}

/**
 * Get snapshot of client state - return just the status as a primitive
 */
function getClientSnapshot(client: SynnelClient): string {
  return client.status
}

/**
 * Hook to access the Synnel client instance
 *
 * @returns The Synnel client instance
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useSynnelClient()
 *
 *   const connect = () => client.connect()
 *   const disconnect = () => client.disconnect()
 *
 *   return (
 *     <div>
 *       <p>Status: {client.status}</p>
 *       <button onClick={connect}>Connect</button>
 *       <button onClick={disconnect}>Disconnect</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useSynnelClient(): SynnelClient {
  const { client } = useSynnelContext()

  // Subscribe to client state changes to trigger re-renders
  // Use status as the snapshot value - it's a primitive string that can be compared with ===
  useSyncExternalStore(
    (callback) => subscribeToClient(client, callback),
    () => getClientSnapshot(client),
    () => 'disconnected', // SSR fallback
  )

  return client
}
