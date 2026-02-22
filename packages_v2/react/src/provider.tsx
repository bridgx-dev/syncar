/**
 * Synnel React Provider
 */

import { type ReactNode } from 'react'
import { SynnelContext } from './context.js'
import type { SynnelProviderProps } from './types.js'

/**
 * Synnel Provider Component
 *
 * Provides the Synnel client instance to all child components via React Context.
 *
 * @example
 * ```tsx
 * import { SynnelProvider } from '@synnel/react-v2'
 * import { createSynnelClient } from '@synnel/client-v2'
 * import { WebSocketTransport } from '@synnel/adapter-ws-v2'
 *
 * const client = createSynnelClient({
 *   transport: new WebSocketTransport({ url: 'ws://localhost:3000' })
 * })
 *
 * function App() {
 *   return (
 *     <SynnelProvider client={client}>
 *       <YourComponents />
 *     </SynnelProvider>
 *   )
 * }
 * ```
 */
export function SynnelProvider({ client, children }: SynnelProviderProps): ReactNode {
  return <SynnelContext.Provider value={{ client }}>{children}</SynnelContext.Provider>
}
