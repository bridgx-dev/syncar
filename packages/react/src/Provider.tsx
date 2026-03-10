/**
 * Syncar React Provider
 */

import { type ReactNode } from 'react'
import { SyncarContext } from './context.js'
import type { SyncarProviderProps } from './types.js'

/**
 * Syncar Provider Component
 *
 * Provides the Syncar client instance to all child components via React Context.
 *
 * @example
 * ```tsx
 * import { SyncarProvider } from '@syncar/react'
 * import { createSyncarClient } from '@syncar/client'
 * import { WebSocketClientTransport } from '@syncar/client'
 *
 * const client = createSyncarClient({
 *   transport: new WebSocketClientTransport({ url: 'ws://localhost:3000' })
 * })
 *
 * function App() {
 *   return (
 *     <SyncarProvider client={client}>
 *       <YourComponents />
 *     </SyncarProvider>
 *   )
 * }
 * ```
 */
export function SyncarProvider({
    client,
    children,
}: SyncarProviderProps): ReactNode {
    return (
        <SyncarContext.Provider value={{ client }}>
            {children}
        </SyncarContext.Provider>
    )
}
