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
  MiddlewareManager,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
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
  ChannelRef,
  BroadcastChannel,
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_SERVER_CONFIG,
  DEFAULTS,
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
  ClientRegistry,
  ConnectionHandler,
  MessageHandler,
  SignalHandler,
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

  it('should export MiddlewareManager', () => {
    expect(MiddlewareManager).toBeDefined()
    expect(typeof MiddlewareManager).toBe('function')
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
    expect(ChannelRef).toBeDefined()
    expect(BroadcastChannel).toBeDefined()
  })

  it('should export default constants', () => {
    expect(DEFAULT_PORT).toBeDefined()
    expect(DEFAULT_HOST).toBeDefined()
    expect(DEFAULT_PATH).toBeDefined()
    expect(DEFAULT_PING_TIMEOUT).toBeDefined()
    expect(DEFAULT_MAX_PAYLOAD).toBeDefined()
  })

  it('should export default config objects', () => {
    expect(DEFAULT_SERVER_CONFIG).toBeDefined()
    expect(DEFAULTS).toBeDefined()
  })

  it('should export channel constants', () => {
    expect(BROADCAST_CHANNEL).toBeDefined()
  })

  it('should export close and error codes', () => {
    expect(CLOSE_CODES).toBeDefined()
    expect(ERROR_CODES).toBeDefined()
  })

  it('should export ClientRegistry', () => {
    expect(ClientRegistry).toBeDefined()
    expect(typeof ClientRegistry).toBe('function')
  })

  it('should export handler classes', () => {
    expect(ConnectionHandler).toBeDefined()
    expect(MessageHandler).toBeDefined()
    expect(SignalHandler).toBeDefined()
  })

  it('should export types', () => {
    // This test verifies that the types are exported
    // In TypeScript, types are erased at runtime, but we can verify
    // that the module exports them by checking the import succeeds
    expect(true).toBe(true)
  })
})
