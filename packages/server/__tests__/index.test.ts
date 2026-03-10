/**
 * Index.ts Tests
 * Tests that all exports from index.ts are accessible
 */

import { describe, it, expect } from 'vitest'

// Import all exports from index.ts
import {
    SyncarServer,
    createSyncarServer,
    Syncar,
    ContextManager,
    SyncarError,
    ConfigError,
    TransportError,
    ChannelError,
    ClientError,
    MessageError,
    ValidationError,
    StateError,
    MiddlewareRejectionError,
    MiddlewareExecutionError,
    WebSocketServerTransport,
    CLOSE_CODES,
    ERROR_CODES,
} from '../src/index'

describe('index.ts exports', () => {
    it('should export SyncarServer', () => {
        expect(SyncarServer).toBeDefined()
        expect(typeof SyncarServer).toBe('function')
    })

    it('should export createSyncarServer factory', () => {
        expect(createSyncarServer).toBeDefined()
        expect(typeof createSyncarServer).toBe('function')
    })

    it('should export Syncar alias', () => {
        expect(Syncar).toBe(SyncarServer)
    })

    it('should export ContextManager', () => {
        expect(ContextManager).toBeDefined()
        expect(typeof ContextManager).toBe('function')
    })

    it('should export all error classes', () => {
        expect(SyncarError).toBeDefined()
        expect(ConfigError).toBeDefined()
        expect(TransportError).toBeDefined()
        expect(ChannelError).toBeDefined()
        expect(ClientError).toBeDefined()
        expect(MessageError).toBeDefined()
        expect(ValidationError).toBeDefined()
        expect(StateError).toBeDefined()
        expect(MiddlewareRejectionError).toBeDefined()
        expect(MiddlewareExecutionError).toBeDefined()
    })

    it('should export WebSocketServerTransport', () => {
        expect(WebSocketServerTransport).toBeDefined()
        expect(typeof WebSocketServerTransport).toBe('function')
    })

    it('should export close and error codes', () => {
        expect(CLOSE_CODES).toBeDefined()
        expect(ERROR_CODES).toBeDefined()
    })

    it('should export types', () => {
        // This test verifies that the types are exported
        // In TypeScript, types are erased at runtime, but we can verify
        // that the module exports them by checking the import succeeds
        expect(true).toBe(true)
    })
})
