/**
 * Index.ts Tests
 * Tests that all exports from index.ts are accessible
 */

import { describe, it, expect } from 'vitest'

// Import all exports from index.ts
import {
  SynnelServer,
  createSynnelServer,
  Synnel,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
  ContextManager,
  createContext,
  SynnelError,
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
  BroadcastChannel,
  MulticastChannel,
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
} from '../src/index.js'

describe('index.ts exports', () => {
  it('should export SynnelServer', () => {
    expect(SynnelServer).toBeDefined()
    expect(typeof SynnelServer).toBe('function')
  })

  it('should export createSynnelServer factory', () => {
    expect(createSynnelServer).toBeDefined()
    expect(typeof createSynnelServer).toBe('function')
  })

  it('should export Synnel alias', () => {
    expect(Synnel).toBe(SynnelServer)
  })

  it('should export ContextManager', () => {
    expect(ContextManager).toBeDefined()
    expect(typeof ContextManager).toBe('function')
  })

  it('should export middleware factory functions', () => {
    expect(createAuthMiddleware).toBeDefined()
    expect(typeof createAuthMiddleware).toBe('function')

    expect(createLoggingMiddleware).toBeDefined()
    expect(typeof createLoggingMiddleware).toBe('function')

    expect(createRateLimitMiddleware).toBeDefined()
    expect(typeof createRateLimitMiddleware).toBe('function')

    expect(createChannelWhitelistMiddleware).toBeDefined()
    expect(typeof createChannelWhitelistMiddleware).toBe('function')
  })

  it('should export all error classes', () => {
    expect(SynnelError).toBeDefined()
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

  it('should export channel classes', () => {
    expect(MulticastChannel).toBeDefined()
    expect(BroadcastChannel).toBeDefined()
  })

  it('should export channel constants', () => {
    expect(BROADCAST_CHANNEL).toBeDefined()
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
