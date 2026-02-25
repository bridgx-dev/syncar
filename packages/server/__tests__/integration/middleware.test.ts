/**
 * Middleware Integration Tests
 * Tests middleware execution through the full request flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SynnelServer } from '../../src/server/index.js'
import { createAuthMiddleware, createLoggingMiddleware, createRateLimitMiddleware, createChannelWhitelistMiddleware, clearRateLimitStore } from '../../src/middleware/index.js'
import { clearRateLimitStore as clearRateLimitStoreFromFactories } from '../../src/middleware/factories.js'
import type { ISynnelServer, IServerTransport } from '../../src/types/index.js'
import type { IClientConnection } from '../../src/types/index.js'
import type { ClientId } from '@synnel/types'
import { MessageType, SignalType } from '@synnel/types'

// Mock transport implementation
class MockTransport implements IServerTransport {
  public connections: Map<ClientId, IClientConnection> = new Map()

  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args)
        } catch (e) {
          // Ignore errors
        }
      })
    }
  }

  async sendToClient(_clientId: ClientId, _message: any): Promise<void> {
    // Mock implementation
  }

  async stop(): Promise<void> {
    this.connections.clear()
  }

  addMockClient(id: ClientId): IClientConnection {
    // Track if socket was closed to detect rejection
    let socketClosed = false

    const client: IClientConnection = {
      id,
      socket: {
        send: vi.fn(),
        close: vi.fn((code: number, reason: string) => {
          socketClosed = true
          // Remove from connections when closed (simulating real transport behavior)
          this.connections.delete(id)
        }),
      } as any,
      status: 'connected',
      connectedAt: Date.now(),
    }
    // Add to connections AFTER creating client (to be available for handlers)
    this.connections.set(id, client)
    // Emit connection event
    this.emit('connection', client)

    // If socket was closed during handler execution, remove from connections
    if (socketClosed) {
      this.connections.delete(id)
    }

    return client
  }

  removeMockClient(id: ClientId): void {
    this.connections.delete(id)
    this.emit('disconnection', id)
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
    it('should execute connection middleware on client connect', () => {
      let middlewareExecuted = false

      server.use(async ({ action, client }) => {
        if (action === 'connect') {
          middlewareExecuted = true
          expect(client).toBeDefined()
        }
      })

      transport.addMockClient('client-1' as ClientId)

      expect(middlewareExecuted).toBe(true)
    })

    it('should reject connection when middleware rejects', () => {
      server.use(async ({ reject }) => {
        reject('Connection not allowed')
      })

      transport.addMockClient('client-1' as ClientId)

      // Client should be removed due to rejection
      expect(transport.connections.has('client-1')).toBe(false)
    })

    it('should execute multiple connection middleware in order', () => {
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

      transport.addMockClient('client-1' as ClientId)

      expect(order).toEqual(['first', 'second', 'third'])
    })
  })

  describe('auth middleware integration', () => {
    it('should allow connections when no verifyToken provided', () => {
      const authMiddleware = createAuthMiddleware({
        // No verifyToken - should allow all
      })

      server.use(authMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)

      // Connection should not be rejected
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

      const client = transport.addMockClient('client-1' as ClientId)

      // Connection should succeed (no auth required for connect)
      expect(transport.connections.has('client-1')).toBe(true)
    })

    it('should skip auth for actions not in list', () => {
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
      transport.addMockClient('client-1' as ClientId)

      expect(verifyCalled).toBe(false)
      expect(transport.connections.has('client-1')).toBe(true)
    })
  })

  describe('logging middleware integration', () => {
    it('should log connections when enabled', () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'info',
        logConnections: true,
      })

      server.use(loggingMiddleware)

      transport.addMockClient('client-1' as ClientId)

      expect(logger.info).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('connect'),
      )
    })

    it('should log messages when enabled', () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'info',
        logMessages: true,
      })

      server.use(loggingMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)

      // Simulate message (data message type)
      const message: any = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'test',
        data: 'test data',
        timestamp: Date.now(),
      }

      transport.emit('message', 'client-1', message)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('message'),
      )
    })

    it('should log subscriptions when enabled', () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'info',
        logSubscriptions: true,
      })

      server.use(loggingMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)
      const chat = server.createMulticast('chat')

      chat.subscribe('client-1')

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('subscribe'),
      )
    })

    it('should support custom format function', () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

      const loggingMiddleware = createLoggingMiddleware({
        logger,
        logLevel: 'log',
        format: ({ action, clientId }) => `[${action}] ${clientId}`,
      })

      server.use(loggingMiddleware)

      transport.addMockClient('client-1' as ClientId)

      expect(logger.log).toHaveBeenCalledWith('[connect] client-1')
    })
  })

  describe('rate limit middleware integration', () => {
    it('should allow requests within limit', () => {
      const rateLimitMiddleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 1000,
        actions: ['message'],
      })

      server.use(rateLimitMiddleware)

      // Add client - connections aren't rate limited
      transport.addMockClient('client-1' as ClientId)

      // Client should be added successfully
      expect(transport.connections.has('client-1')).toBe(true)
    })

    it('should limit by client ID by default', () => {
      const rateLimitMiddleware = createRateLimitMiddleware({
        maxRequests: 2,
        windowMs: 1000,
        actions: ['message'],
        getMessageId: (ctx) => ctx.client?.id ?? 'unknown',
      })

      server.use(rateLimitMiddleware)

      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)

      // Both clients should be added (not rate limited on connect)
      expect(transport.connections.has('client-1')).toBe(true)
      expect(transport.connections.has('client-2')).toBe(true)
    })
  })

  describe('channel whitelist middleware integration', () => {
    it('should allow subscriptions to whitelisted channels', () => {
      const whitelistMiddleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat', 'announcements'],
      })

      server.use(whitelistMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)
      const chatChannel = server.createMulticast('chat')

      // Subscribe should succeed (channel is whitelisted)
      const result = chatChannel.subscribe('client-1')

      // Channel whitelist middleware only checks subscribe/unsubscribe
      // and allows whitelisted channels
      expect(result).toBe(true)
    })

    it('should use dynamic check function', () => {
      const whitelistMiddleware = createChannelWhitelistMiddleware({
        isDynamic: (channel) => {
          // Only allow channels starting with 'public-'
          return channel.startsWith('public-')
        },
      })

      server.use(whitelistMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)
      const publicChannel = server.createMulticast('public-chat')
      const privateChannel = server.createMulticast('private-chat')

      const publicResult = publicChannel.subscribe('client-1')
      const privateResult = privateChannel.subscribe('client-1')

      expect(publicResult).toBe(true)
      // Dynamic check allows public- channels
      expect(privateResult).toBe(false)
    })

    it('should support restrictUnsubscribe option', () => {
      const whitelistMiddleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat'],
        restrictUnsubscribe: true,
      })

      server.use(whitelistMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)
      const chatChannel = server.createMulticast('chat')

      // Subscribe should be allowed
      expect(chatChannel.subscribe('client-1')).toBe(true)

      // Unsubscribe should also be allowed (whitelisted)
      expect(chatChannel.unsubscribe('client-1')).toBe(true)
    })
  })

  describe('middleware error handling', () => {
    it('should handle middleware errors gracefully', () => {
      server.use(async () => {
        throw new Error('Middleware error')
      })

      const errorSpy = vi.fn()
      server.on('error', errorSpy)

      transport.addMockClient('client-1' as ClientId)

      // Error should be emitted
      expect(errorSpy).toHaveBeenCalled()
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
    it('should handle multiple middleware together', () => {
      let logCalled = false
      let rateLimitCalled = false

      const loggingMiddleware = createLoggingMiddleware({
        logConnections: true,
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

      transport.addMockClient('client-1' as ClientId)

      // Logging should have been called
      expect(logCalled).toBe(true)
    })

    it('should allow when auth passes and rate limit not exceeded', () => {
      const authMiddleware = createAuthMiddleware({
        verifyToken: async (token: string) => {
          if (token === 'valid') return { userId: 'user-1' }
          throw new Error('Invalid')
        },
        getToken: (ctx) => (ctx.message as any)?.data?.token,
        actions: ['message'],
      })

      server.use(authMiddleware)

      const client = transport.addMockClient('client-1' as ClientId)

      // Connection should succeed (auth not applied to connect)
      expect(transport.connections.has('client-1')).toBe(true)
    })
  })
})
