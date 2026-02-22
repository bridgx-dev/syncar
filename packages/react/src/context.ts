/**
 * React Context for Synnel
 */

import { createContext, useContext } from 'react'
import type { SynnelContextValue } from './types.js'

/**
 * Synnel React Context
 */
export const SynnelContext = createContext<SynnelContextValue | null>(null)

/**
 * Hook to access the Synnel context
 * @throws {MissingProviderError} if used outside of SynnelProvider
 */
export function useSynnelContext(): SynnelContextValue {
  const context = useContext(SynnelContext)

  if (!context) {
    throw new Error(
      'Synnel hooks must be used within a SynnelProvider. ' +
        'Wrap your component tree with <SynnelProvider client={client}>.',
    )
  }

  return context
}
