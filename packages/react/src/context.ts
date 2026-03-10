/**
 * React Context for Syncar
 */

import { createContext, useContext } from 'react'
import type { SyncarContextValue } from './types.js'

/**
 * Syncar React Context
 */
export const SyncarContext = createContext<SyncarContextValue | null>(null)

/**
 * Hook to access the Syncar context
 * @throws {MissingProviderError} if used outside of SyncarProvider
 */
export function useSyncarContext(): SyncarContextValue {
    const context = useContext(SyncarContext)

    if (!context) {
        throw new Error(
            'Syncar hooks must be used within a SyncarProvider. ' +
                'Wrap your component tree with <SyncarProvider client={client}>.',
        )
    }

    return context
}
