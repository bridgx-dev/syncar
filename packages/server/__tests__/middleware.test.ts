/**
 * Middleware Tests
 * Tests for middleware manager and middleware factories
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MiddlewareManager } from '../src/middleware/index.js'
import { MiddlewareRejectionError, MiddlewareExecutionError } from '../src/errors/index.js'
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
  clearRateLimitStore,
} from '../src/middleware/factories.js'
import type { ServerClient } from '../src/types/index.js'
import type { Message, DataMessage } from '@synnel/types'
import { MessageType } from '@synnel/types'

// Mock client
const createMockClient = (id: string): ServerClient => {
  const metadata: Map<string, unknown> = new Map()
  return {
    id,
    status: 'connected' as const,
    connectedAt: Date.now(),
    get metadata() {
      return Object.fromEntries(metadata)
    },
    send: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(true),
    isSubscribed: vi.fn().mockReturnValue(false),
    getSubscriptions: vi.fn().mockReturnValue([]),
    getConnection: vi.fn(),
    setMetadata: (key: string, value: unknown) => {
      metadata.set(key, value)
    },
    getMetadata: <T = unknown>(key: string) => {
      return metadata.get(key) as T | undefined
    },
  }
}

describe('MiddlewareManager', () => {
  let manager: MiddlewareManager
  let mockClient: ServerClient

  beforeEach(() => {
    manager = new MiddlewareManager()
    mockClient = createMockClient('client-1')
  })

  describe('basic operations', () => {
    it('should add and execute middleware', async () => {
      const handler = vi.fn()
      manager.use(async ({ client }) => {
        handler(client?.id)
      })

      await manager.executeConnection(mockClient, 'connect')

      expect(handler).toHaveBeenCalledWith('client-1')
    })

    it('should remove middleware', () => {
      const middleware = async () => {}
      manager.use(middleware)

      expect(manager.remove(middleware)).toBe(true)
      expect(manager.remove(middleware)).toBe(false)
    })

    it('should clear all middleware', async () => {
      manager.use(async () => {})
      manager.use(async () => {})

      manager.clear()

      // Should not throw since no middleware to execute
      await manager.executeConnection(mockClient, 'connect')
    })

    it('should get middleware count', () => {
      expect(manager.getCount()).toBe(0)

      manager.use(async () => {})
      manager.use(async () => {})

      expect(manager.getCount()).toBe(2)
    })

    it('should check if has middleware', () => {
      expect(manager.hasMiddleware()).toBe(false)

      manager.use(async () => {})

      expect(manager.hasMiddleware()).toBe(true)
    })
  })

  describe('connection actions', () => {
    it('should execute connection middleware on connect', async () => {
      const handler = vi.fn()
      manager.use(async ({ action }) => {
        handler(action)
      })

      await manager.executeConnection(mockClient, 'connect')

      expect(handler).toHaveBeenCalledWith('connect')
    })

    it('should execute connection middleware on disconnect', async () => {
      const handler = vi.fn()
      manager.use(async ({ action }) => {
        handler(action)
      })

      await manager.executeConnection(mockClient, 'disconnect')

      expect(handler).toHaveBeenCalledWith('disconnect')
    })
  })

  describe('message actions', () => {
    it('should execute message middleware', async () => {
      const handler = vi.fn()
      manager.use(async ({ message }) => {
        handler(message)
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      await manager.executeMessage(mockClient, message)

      expect(handler).toHaveBeenCalledWith(message)
    })
  })

  describe('subscribe actions', () => {
    it('should execute subscribe middleware', async () => {
      const handler = vi.fn()
      manager.use(async ({ channel, action }) => {
        handler(channel, action)
      })

      await manager.executeSubscribe(mockClient, 'chat')

      expect(handler).toHaveBeenCalledWith('chat', 'subscribe')
    })
  })

  describe('unsubscribe actions', () => {
    it('should execute unsubscribe middleware', async () => {
      const handler = vi.fn()
      manager.use(async ({ channel, action }) => {
        handler(channel, action)
      })

      await manager.executeUnsubscribe(mockClient, 'chat')

      expect(handler).toHaveBeenCalledWith('chat', 'unsubscribe')
    })
  })

  describe('rejection', () => {
    it('should reject action when reject() is called', async () => {
      manager.use(async ({ reject }) => {
        reject('Not allowed')
      })

      await expect(
        manager.executeConnection(mockClient, 'connect'),
      ).rejects.toThrow(MiddlewareRejectionError)
    })

    it('should provide rejection reason', async () => {
      manager.use(async ({ reject }) => {
        reject('Custom reason')
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(MiddlewareRejectionError)
        expect((error as MiddlewareRejectionError).reason).toBe('Custom reason')
        expect((error as MiddlewareRejectionError).action).toBe('connect')
      }
    })

    it('should wrap thrown errors in MiddlewareExecutionError', async () => {
      manager.use(async () => {
        throw new Error('Test error')
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(MiddlewareExecutionError)
        expect((error as MiddlewareExecutionError).action).toBe('connect')
      }
    })
  })

  describe('execution order', () => {
    it('should execute middleware in order', async () => {
      const order: string[] = []

      manager.use(async () => {
        order.push('first')
      })

      manager.use(async () => {
        order.push('second')
      })

      manager.use(async () => {
        order.push('third')
      })

      await manager.executeConnection(mockClient, 'connect')

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('should stop execution on rejection', async () => {
      const order: string[] = []

      manager.use(async () => {
        order.push('first')
      })

      manager.use(async ({ reject }) => {
        order.push('rejected')
        reject('Stop here')
      })

      manager.use(async () => {
        order.push('third')
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
      } catch {
        // Expected rejection
      }

      expect(order).toEqual(['first', 'rejected'])
      expect(order).not.toContain('third')
    })
  })

  describe('context factory', () => {
    it('should create connection context', () => {
      const context = manager.createConnectionContext(mockClient, 'connect')

      expect(context.client).toBe(mockClient)
      expect(context.action).toBe('connect')
      expect(context.message).toBeUndefined()
      expect(context.channel).toBeUndefined()
    })

    it('should create message context', () => {
      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      const context = manager.createMessageContext(mockClient, message)

      expect(context.client).toBe(mockClient)
      expect(context.action).toBe('message')
      expect(context.message).toBe(message)
      expect(context.channel).toBeUndefined()
    })

    it('should create subscribe context', () => {
      const context = manager.createSubscribeContext(mockClient, 'chat')

      expect(context.client).toBe(mockClient)
      expect(context.action).toBe('subscribe')
      expect(context.channel).toBe('chat')
      expect(context.message).toBeUndefined()
    })

    it('should create unsubscribe context', () => {
      const context = manager.createUnsubscribeContext(mockClient, 'chat')

      expect(context.client).toBe(mockClient)
      expect(context.action).toBe('unsubscribe')
      expect(context.channel).toBe('chat')
      expect(context.message).toBeUndefined()
    })
  })
})

describe('Middleware Factories', () => {
  let manager: MiddlewareManager
  let mockClient: ServerClient

  beforeEach(() => {
    manager = new MiddlewareManager()
    mockClient = createMockClient('client-1')
  })

  describe('createAuthMiddleware', () => {
    it('should verify token when provided', async () => {
      const middleware = createAuthMiddleware({
        verifyToken: async (token) => {
          if (token === 'valid-token') {
            return { userId: 'user-123' }
          }
          throw new Error('Invalid token')
        },
        getToken: (context) => {
          return (context.message as any)?.data?.token
        },
      })

      manager.use(middleware)

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { token: 'valid-token' },
        timestamp: Date.now(),
      }

      await manager.executeMessage(mockClient, message)

      // Should not throw
    })

    it('should reject when token is missing', async () => {
      const middleware = createAuthMiddleware({
        verifyToken: async () => {
          throw new Error('Should not be called')
        },
        getToken: (context) => {
          return (context.message as any)?.data?.token
        },
      })

      manager.use(middleware)

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: {}, // No token
        timestamp: Date.now(),
      }

      await expect(
        manager.executeMessage(mockClient, message),
      ).rejects.toThrow('Authentication token required')
    })

    it('should reject invalid token', async () => {
      const middleware = createAuthMiddleware({
        verifyToken: async () => {
          throw new Error('Invalid token')
        },
        getToken: (context) => {
          return (context.message as any)?.data?.token
        },
      })

      manager.use(middleware)

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { token: 'invalid-token' },
        timestamp: Date.now(),
      }

      await expect(
        manager.executeMessage(mockClient, message),
      ).rejects.toThrow()
    })

    it('should attach user data to client', async () => {
      const middleware = createAuthMiddleware({
        verifyToken: async () => {
          return { userId: 'user-123', role: 'admin' }
        },
        getToken: (context) => {
          return (context.message as any)?.data?.token
        },
        attachProperty: 'user',
      })

      manager.use(middleware)

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { token: 'valid-token' },
        timestamp: Date.now(),
      }

      await manager.executeMessage(mockClient, message)

      expect((mockClient as any).user).toEqual({ userId: 'user-123', role: 'admin' })
    })

    it('should only check specified actions', async () => {
      const middleware = createAuthMiddleware({
        verifyToken: async () => {
          throw new Error('Should not be called')
        },
        actions: ['message'], // Only check message actions
      })

      manager.use(middleware)

      // Should not throw for connect (not in actions)
      await manager.executeConnection(mockClient, 'connect')
    })
  })

  describe('createLoggingMiddleware', () => {
    it('should log connections when enabled', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const middleware = createLoggingMiddleware({
        logConnections: true,
        logger,
        logLevel: 'log',
      })

      manager.use(middleware)
      await manager.executeConnection(mockClient, 'connect')

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('connect'),
      )
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('client-1'),
      )
    })

    it('should log messages when enabled', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const middleware = createLoggingMiddleware({
        logMessages: true,
        logger,
        logLevel: 'info',
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      manager.use(middleware)
      await manager.executeMessage(mockClient, message)

      expect(logger.info).toHaveBeenCalled()
      const logMessage = logger.info.mock.calls[0][0] as string
      expect(logMessage).toContain('message')
      expect(logMessage).toContain('client-1')
    })

    it('should log subscriptions when enabled', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const middleware = createLoggingMiddleware({
        logSubscriptions: true,
        logger,
        logLevel: 'warn',
      })

      manager.use(middleware)
      await manager.executeSubscribe(mockClient, 'chat')

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('subscribe'),
      )
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('chat'),
      )
    })

    it('should use custom format function', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const middleware = createLoggingMiddleware({
        logger,
        logLevel: 'log',
        format: ({ action, clientId }) => `[${action}] ${clientId}`,
      })

      manager.use(middleware)
      await manager.executeConnection(mockClient, 'connect')

      expect(logger.log).toHaveBeenCalledWith('[connect] client-1')
    })

    it('should only log specified actions', async () => {
      const logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
      const middleware = createLoggingMiddleware({
        logger,
        logLevel: 'log',
        actions: ['message'], // Only log messages
      })

      manager.use(middleware)

      await manager.executeConnection(mockClient, 'connect')
      expect(logger.log).not.toHaveBeenCalled()
    })
  })

  describe('createRateLimitMiddleware', () => {
    beforeEach(() => {
      // Clear rate limit store before each test
      clearRateLimitStore()
    })

    it('should allow requests within limit', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 1000,
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      manager.use(middleware)

      // Send 5 messages (within limit)
      for (let i = 0; i < 5; i++) {
        await manager.executeMessage(mockClient, message)
      }

      // Should not throw
    })

    it('should reject requests exceeding limit', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 3,
        windowMs: 1000,
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      manager.use(middleware)

      // Send 3 messages (at limit)
      for (let i = 0; i < 3; i++) {
        await manager.executeMessage(mockClient, message)
      }

      // 4th message should be rejected
      await expect(
        manager.executeMessage(mockClient, message),
      ).rejects.toThrow(MiddlewareRejectionError)
    })

    it('should use custom getMessageId', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 2,
        windowMs: 1000,
        getMessageId: () => 'shared-id', // All requests share same ID
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      manager.use(middleware)

      // First client
      await manager.executeMessage(mockClient, message)
      await manager.executeMessage(mockClient, message)

      // Should reject because shared ID exceeded limit
      await expect(
        manager.executeMessage(mockClient, message),
      ).rejects.toThrow(MiddlewareRejectionError)
    })

    it('should only rate limit specified actions', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 1,
        windowMs: 1000,
        actions: ['message'], // Only rate limit messages
      })

      manager.use(middleware)

      // Connect should not be rate limited
      await manager.executeConnection(mockClient, 'connect')
      await manager.executeConnection(mockClient, 'connect')
    })
  })

  describe('createChannelWhitelistMiddleware', () => {
    it('should allow whitelisted channels on subscribe', async () => {
      const middleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat', 'notifications'],
      })

      manager.use(middleware)

      // Should not throw for whitelisted channel
      await manager.executeSubscribe(mockClient, 'chat')
    })

    it('should reject non-whitelisted channels on subscribe', async () => {
      const middleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat', 'notifications'],
      })

      manager.use(middleware)

      await expect(
        manager.executeSubscribe(mockClient, 'random'),
      ).rejects.toThrow("Channel 'random' is not allowed")
    })

    it('should use dynamic check function', async () => {
      const middleware = createChannelWhitelistMiddleware({
        isDynamic: (channel, client) => {
          // Only allow channels starting with 'public-'
          return channel.startsWith('public-')
        },
      })

      manager.use(middleware)

      // Should allow
      await manager.executeSubscribe(mockClient, 'public-chat')

      // Should reject
      await expect(
        manager.executeSubscribe(mockClient, 'private-chat'),
      ).rejects.toThrow("Channel 'private-chat' is not allowed")
    })

    it('should not restrict unsubscribe by default', async () => {
      const middleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat'], // Only chat is whitelisted
      })

      manager.use(middleware)

      // Should not reject unsubscribe for non-whitelisted channel
      await manager.executeUnsubscribe(mockClient, 'random')
    })

    it('should restrict unsubscribe when enabled', async () => {
      const middleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat'],
        restrictUnsubscribe: true,
      })

      manager.use(middleware)

      await expect(
        manager.executeUnsubscribe(mockClient, 'random'),
      ).rejects.toThrow("Channel 'random' is not allowed")
    })

    it('should not check message actions', async () => {
      const middleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat'],
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'random', // Not whitelisted
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      manager.use(middleware)

      // Should not throw - channel whitelist only checks subscribe/unsubscribe
      await manager.executeMessage(mockClient, message)
    })
  })
})
