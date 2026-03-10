/**
 * Test Setup for @syncar/server
 */

import { beforeEach, afterEach, vi } from 'vitest'
import type { IClientConnection } from '../src/types'

/**
 * Create a mock client for testing
 */
export const createMockClient = (id: string): IClientConnection => {
    return {
        id,
        connectedAt: Date.now(),
        socket: {
            send: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
        } as any,
    }
}

// Cleanup after each test
afterEach(() => {
    vi.clearAllMocks()
})
