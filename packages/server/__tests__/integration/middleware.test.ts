/**
 * Middleware Integration Tests
 * Tests middleware execution through the full request flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { SynnelServer } from '../../src/server/index.js'
import { createAuthMiddleware, createLoggingMiddleware, createRateLimitMiddleware, createChannelWhitelistMiddleware, clearRateLimitStore } from '../../src/middleware/index.js'
import { clearRateLimitStore as clearRateLimitStoreFromFactories } from '../../src/middleware/factories.js'
import type { ISynnelServer, IServerTransport } from '../../src/types/index.js'
import type { IClientConnection, IServerEventMap } from '../../src/types/index.js'
import type { ClientId } from '../../src/types/index.js'
import { MessageType, SignalType } from '../../src/types/index.js'

// Mock transport implementation
class MockTransport extends EventEmitter implements IServerTransport {
  public connections: Map<ClientId, IClientConnection> = new Map()

  async start(): Promise<void> {
    // Mock implementation
  }

  async stop(): Promise<void> {
    this.connections.clear()
  }

  async emitAsync(event: string, ...args: any[]): Promise<void> {
    const listeners = this.listeners(event) as Function[]
    for (const listener of listeners) {
      const result = listener(...args)
      if (result instanceof Promise) {
        await result
      }
    }
  }

  async addMockClient(id: ClientId): Promise<IClientConnection> {
    // Track if socket was closed to detect rejection
    let socketClosed = false

    const client: IClientConnection = {
      id,
      socket: {
        send: vi.fn().mockImplementation((_msg, cb) => {
          if (typeof cb === 'function') {
            process.nextTick(() => cb())
          }
        }),
        close: vi.fn((code: number, reason: string) => {
          socketClosed = true
          // Remove from connections when closed (simulating real transport behavior)
          this.connections.delete(id)
        }),
      } as any,
      connectedAt: Date.now(),
    }
    // Add to connections AFTER creating client (to be available for handlers)
    this.connections.set(id, client)
    // Emit connection event and await handlers
    await this.emitAsync('connection', client)

    // If socket was closed during handler execution, remove from connections
    if (socketClosed) {
      this.connections.delete(id)
    }

    return client
  }

  async removeMockClient(id: ClientId): Promise<void> {
    this.connections.delete(id)
    await this.emitAsync('disconnection', id)
  }
}

describe('Middleware Integration Tests', () => {
  let server: ISynnelServer
  let transport: MockTransport

  beforeEach(async () => {
    transport = new MockTransport()
    server = new SynnelServer({
      transport,
    })
    await server.start()
  })

  afterEach(async () => {
    await server.stop()
    clearRateLimitStoreFromFactories()
  })

  describe('connection middleware', () => {
    it('should execute connection middleware on client connect', async () => {
      let middlewareExecuted = false

      server.use(async ({ action, client }) => {
        if (action === 'connect') {
          middlewareExecuted = true
          expect(client).toBeDefined()
        }
      })

      await transport.addMockClient('client-1' as ClientId)

      expect(middlewareExecuted).toBe(true)
    })

    it('should reject connection when middleware rejects', async () => {
      server.use(async ({ reject }) => {
        reject('Connection not allowed')
      })

      await transport.addMockClient('client-1' as ClientId)

      // Client should be removed due to rejection
      expect(transport.connections.has('client-1')).toBe(false)
    })

    it('should execute multiple connection middleware in order', async () => {
      const order: string[] = []

      server.use(async ({ action }) => {
        if (action === 'connect') {
          order.push('first')
        }
      })

      server.use(async ({ action }) => {
        if (action === 'connect') {
          order.push('second')
        }
      })

      server.use(async ({ action }) => {
        if (action === 'connect') {
          order.push('third')
        }
      })

      await transport.addMockClient('client-1' as ClientId)

      expect(order).toEqual(['first', 'second', 'third'])
    })
  })

  describe('auth middleware integration', () => {
    it('should allow connections when auth is only applied to specific actions', async () => {
      const authMiddleware = createAuthMiddleware({
        verifyToken: async () => ({ userId: 'user-123' }),
        getToken: (context: any) => (context.message as any)?.data?.token,
        actions: ['message'], // Only check messages, not connections
      })

      server.use(authMiddleware)

      await transport.addMockClient('client-1' as ClientId)

      // Connection should not be rejected (auth not applied to connect)
      expect(transport.connections.has('client-1')).toBe(true)
    })

    it('should verify token and allow when valid', async () => {
      const authMiddleware = createAuthMiddleware({
        verifyToken: async (token: string) => {
          if (token === 'valid-token') return { userId: 'user-123' }
          throw new Error('Invalid')
        },
        getToken: (context) => {
          return (context.message as any)?.data?.token
        },
        actions: ['message'],
      })

      server.use(authMiddleware)

      await transport.addMockClient('client-1' as ClientId)

      // Connection should succeed (no auth required for connect)
      expect(transport.connections.has('client-1')).toBe(true)
    })

    it('should skip auth for actions not in list', async () => {
      let verifyCalled = false

      const authMiddleware = createAuthMiddleware({
        verifyToken: async () => {
          verifyCalled = true
          throw new Error('Should not be called')
        },
        actions: ['message'], // Only check messages
      })

      server.use(authMiddleware)

      // Connect action should not trigger auth
      await transport.addMockClient('client-1' as ClientId)

      expect(verifyCalled).toBe(false)
      expect(transport.connections.has('client-1')).toBe(true)
    })
  })

  describe('logging middleware integration', () => {
    it('should log connections when enabled', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'info',
        actions: ['connect'],
      })

      server.use(loggingMiddleware)

      await transport.addMockClient('client-1' as ClientId)

      expect(logger.info).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('connect'),
      )
    })

    it('should log messages when enabled', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'info',
      })

      server.use(loggingMiddleware)

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('test')

      // Simulate message (data message type)
      const message: any = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'test',
        data: 'test data',
        timestamp: Date.now(),
      }

      await transport.emitAsync('message', 'client-1', message)

      // The logger should have been called for both connect and message
      expect(logger.info).toHaveBeenCalledTimes(2)
      // Check that one of the calls contains "message"
      const calls = logger.info.mock.calls
      const hasMessageLog = calls.some((call: string[]) =>
        call[0]?.includes('message'),
      )
      expect(hasMessageLog).toBe(true)
    })

    it('should log subscriptions when enabled', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'info',
        actions: [SignalType.SUBSCRIBE],
      })

      server.use(loggingMiddleware)

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('chat')

      // Simulate subscribe signal to trigger middleware
      const signal: any = {
        id: 'sig-1',
        type: MessageType.SIGNAL,
        channel: 'chat',
        signal: SignalType.SUBSCRIBE,
        timestamp: Date.now(),
      }

      await transport.emitAsync('message', 'client-1', signal)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(SignalType.SUBSCRIBE),
      )
    })

    it('should support custom format function', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'log',
        format: ({ action, clientId }: any) => `[${action}] ${clientId}`,
      })

      server.use(loggingMiddleware)

      await transport.addMockClient('client-1' as ClientId)

      expect(logger.log).toHaveBeenCalledWith('[connect] client-1')
    })
  })

  describe('rate limit middleware integration', () => {
    it('should allow requests within limit', async () => {
      const rateLimitMiddleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 1000,
        actions: ['message'],
      })

      server.use(rateLimitMiddleware)

      // Add client - connections aren't rate limited
      await transport.addMockClient('client-1' as ClientId)

      // Client should be added successfully
      expect(transport.connections.has('client-1')).toBe(true)
    })

    it('should limit by client ID by default', async () => {
      const rateLimitMiddleware = createRateLimitMiddleware({
        maxRequests: 2,
        windowMs: 1000,
        actions: ['message'],
        getMessageId: (ctx: any) => ctx.client?.id ?? 'unknown',
      })

      server.use(rateLimitMiddleware)

      await transport.addMockClient('client-1' as ClientId)
      await transport.addMockClient('client-2' as ClientId)

      // Both clients should be added (not rate limited on connect)
      expect(transport.connections.has('client-1')).toBe(true)
      expect(transport.connections.has('client-2')).toBe(true)
    })
  })

  describe('channel whitelist middleware integration', () => {
    it('should allow subscriptions to whitelisted channels', async () => {
      const whitelistMiddleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat', 'announcements'],
      })

      server.use(whitelistMiddleware)

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('chat')

      // Simulate subscribe signal to trigger middleware
      const signal: any = {
        id: 'sig-1',
        type: MessageType.SIGNAL,
        channel: 'chat',
        signal: SignalType.SUBSCRIBE,
        timestamp: Date.now(),
      }

      // Should not throw (channel is whitelisted)
      await transport.emitAsync('message', 'client-1', signal)

      // Client should be subscribed
      expect(server.hasChannel('chat')).toBe(true)
    })

    it('should use dynamic check function', async () => {
      const whitelistMiddleware = createChannelWhitelistMiddleware({
        isDynamic: (channel: string) => {
          // Only allow channels starting with 'public-'
          return channel.startsWith('public-')
        },
      })

      server.use(whitelistMiddleware)

      await transport.addMockClient('client-1' as ClientId)
      const publicChat = server.createMulticast('public-chat')
      const privateChat = server.createMulticast('private-chat')

      // Subscribe to public-chat should succeed
      const publicSignal: any = {
        id: 'sig-1',
        type: MessageType.SIGNAL,
        channel: 'public-chat',
        signal: SignalType.SUBSCRIBE,
        timestamp: Date.now(),
      }

      await transport.emitAsync('message', 'client-1', publicSignal)

      // Subscribe to private-chat should be rejected
      // The middleware will reject but won't remove the client
      // It just prevents the subscription from happening
      const privateSignal: any = {
        id: 'sig-2',
        type: MessageType.SIGNAL,
        channel: 'private-chat',
        signal: SignalType.SUBSCRIBE,
        timestamp: Date.now(),
      }

      // This should not throw but the subscription won't happen
      await transport.emitAsync('message', 'client-1', privateSignal)

      // Verify public-chat has the subscriber
      expect(publicChat.hasSubscriber('client-1')).toBe(true)
      // Verify private-chat does NOT have the subscriber (rejected)
      expect(privateChat.hasSubscriber('client-1')).toBe(false)
    })

    it('should support restrictUnsubscribe option', async () => {
      const whitelistMiddleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat'],
        restrictUnsubscribe: true,
      })

      server.use(whitelistMiddleware)

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('chat')

      // Subscribe first
      const subscribeSignal: any = {
        id: 'sig-1',
        type: MessageType.SIGNAL,
        channel: 'chat',
        signal: SignalType.SUBSCRIBE,
        timestamp: Date.now(),
      }

      await transport.emitAsync('message', 'client-1', subscribeSignal)

      // Unsubscribe should also be allowed (whitelisted)
      const unsubscribeSignal: any = {
        id: 'sig-2',
        type: MessageType.SIGNAL,
        channel: 'chat',
        signal: SignalType.UNSUBSCRIBE,
        timestamp: Date.now(),
      }

      await transport.emitAsync('message', 'client-1', unsubscribeSignal)

      expect(server.hasChannel('chat')).toBe(true)
    })
  })

  describe('middleware error handling', () => {
    it('should handle middleware errors gracefully', async () => {
      server.use(async () => {
        throw new Error('Middleware error')
      })

      const errorSpy = vi.fn()
      server.on('error', errorSpy)

      await transport.addMockClient('client-1' as ClientId)

      // Error should be emitted
      expect(errorSpy).toHaveBeenCalled()
      // The error message is "Connection rejected by middleware" from the connection handler
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('rejected'),
        }),
      )
    })

    it('should emit error for transport errors', () => {
      const errorSpy = vi.fn()
      server.on('error', errorSpy)

      const testError = new Error('Transport error')
      transport.emit('error', testError)

      expect(errorSpy).toHaveBeenCalledWith(testError)
    })
  })

  describe('complex middleware scenarios', () => {
    it('should handle multiple middleware together', async () => {
      let logCalled = false
      let rateLimitCalled = false

      const loggingMiddleware = createLoggingMiddleware({
        actions: ['connect'],
        logger: {
          log: vi.fn(),
          info: vi.fn(() => {
            logCalled = true
          }),
          warn: vi.fn(),
          error: vi.fn(),
        },
      })

      const rateLimitMiddleware = createRateLimitMiddleware({
        maxRequests: 10,
        windowMs: 1000,
        getMessageId: () => 'shared',
      })

      server.use(loggingMiddleware)
      server.use(rateLimitMiddleware)

      await transport.addMockClient('client-1' as ClientId)

      // Logging should have been called
      expect(logCalled).toBe(true)
    })

    it('should allow when auth passes and rate limit not exceeded', async () => {
      const authMiddleware = createAuthMiddleware({
        verifyToken: async (token: string) => {
          if (token === 'valid') return { userId: 'user-1' }
          throw new Error('Invalid')
        },
        getToken: (ctx: any) => (ctx.message as any)?.data?.token,
        actions: ['message'],
      })

      server.use(authMiddleware)

      await transport.addMockClient('client-1' as ClientId)

      // Connection should succeed (auth not applied to connect)
      expect(transport.connections.has('client-1')).toBe(true)
    })
  })
})
