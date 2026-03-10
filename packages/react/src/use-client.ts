/**
 * useSyncarClient Hook
 *
 * Hook to access the Syncar client instance from context.
 */

import { useSyncExternalStore } from 'react'
import { useSyncarContext } from './context.js'
import type { SyncarClient } from '@syncar/client'

/**
 * Subscribe to client state changes
 */
function subscribeToClient(
    client: SyncarClient,
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
function getClientSnapshot(client: SyncarClient): string {
    return client.status
}

/**
 * Hook to access the Syncar client instance
 *
 * @returns The Syncar client instance
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const client = useSyncarClient()
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
export function useSyncarClient(): SyncarClient {
    const { client } = useSyncarContext()

    // Subscribe to client state changes to trigger re-renders
    // Use status as the snapshot value - it's a primitive string that can be compared with ===
    useSyncExternalStore(
        (callback) => subscribeToClient(client, callback),
        () => getClientSnapshot(client),
        () => 'disconnected', // SSR fallback
    )

    return client
}
