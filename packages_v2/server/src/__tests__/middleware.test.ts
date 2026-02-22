/**
 * Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MiddlewareManager,
  MiddlewareRejectionError,
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from '../middleware.js'
import type { ServerClient } from '../types.js'
import type { Message, DataMessage } from '@synnel/core-v2'
import { MessageType } from '@synnel/core-v2'

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
    getSubscriptions: vi.fn().mockReturnValue([]),
    hasSubscription: vi.fn().mockReturnValue(false),
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

      await expect(manager.executeConnection(mockClient, 'connect')).rejects.toThrow(
        MiddlewareRejectionError,
      )
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
})

describe('Middleware Factories', () => {
  let mockClient: ServerClient

  beforeEach(() => {
    mockClient = createMockClient('client-1')
  })

  describe('createAuthMiddleware', () => {
    it('should allow connection when no token', async () => {
      const middleware = createAuthMiddleware({})
      const manager = new MiddlewareManager()
      manager.use(middleware)

      // Should not throw
      await manager.executeConnection(mockClient, 'connect')
    })

    it('should verify token when provided', async () => {
      const middleware = createAuthMiddleware({
        getToken: (client) => client.getMetadata<string>('token'),
        verify: async (token) => {
          if (token === 'valid-token') {
            return 'user-123'
          }
          throw new Error('Invalid token')
        },
      })

      mockClient.setMetadata('token', 'valid-token')

      const manager = new MiddlewareManager()
      manager.use(middleware)

      await manager.executeConnection(mockClient, 'connect')

      expect(mockClient.getMetadata('userId')).toBe('user-123')
    })

    it('should reject invalid token', async () => {
      const middleware = createAuthMiddleware({
        getToken: (client) => client.getMetadata<string>('token'),
        verify: async () => {
          throw new Error('Invalid token')
        },
      })

      mockClient.setMetadata('token', 'invalid-token')

      const manager = new MiddlewareManager()
      manager.use(middleware)

      await expect(manager.executeConnection(mockClient, 'connect')).rejects.toThrow(
        'Authentication failed'
      )
    })
  })

  describe('createLoggingMiddleware', () => {
    it('should log connections when enabled', () => {
      const logger = vi.fn()
      const middleware = createLoggingMiddleware({
        logConnections: true,
        logger,
      })

      const manager = new MiddlewareManager()
      manager.use(middleware)

      manager.executeConnection(mockClient, 'connect')

      expect(logger).toHaveBeenCalledWith(expect.stringContaining('Client connected'))
    })

    it('should log messages when enabled', () => {
      const logger = vi.fn()
      const middleware = createLoggingMiddleware({
        logMessages: true,
        logger,
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      const manager = new MiddlewareManager()
      manager.use(middleware)

      manager.executeMessage(mockClient, message)

      expect(logger).toHaveBeenCalled()
      const logMessage = logger.mock.calls[0][0] as string
      expect(logMessage).toContain('Message from')
      expect(logMessage).toContain('chat')
    })

    it('should log subscriptions when enabled', () => {
      const logger = vi.fn()
      const middleware = createLoggingMiddleware({
        logSubscriptions: true,
        logger,
      })

      const manager = new MiddlewareManager()
      manager.use(middleware)

      manager.executeSubscribe(mockClient, 'chat')

      expect(logger).toHaveBeenCalledWith(expect.stringContaining('subscribed to chat'))
    })
  })

  describe('createRateLimitMiddleware', () => {
    it('should allow messages within limit', async () => {
      const middleware = createRateLimitMiddleware({
        maxMessages: 5,
        windowMs: 1000,
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      const manager = new MiddlewareManager()
      manager.use(middleware)

      // Send 5 messages (within limit) - should all succeed
      for (let i = 0; i < 5; i++) {
        await manager.executeMessage(mockClient, message)
      }

      // Note: The 6th message would be rejected
    })

    it('should reject messages exceeding limit', async () => {
      const middleware = createRateLimitMiddleware({
        maxMessages: 3,
        windowMs: 1000,
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      const manager = new MiddlewareManager()
      manager.use(middleware)

      // Send 3 messages (at limit)
      for (let i = 0; i < 3; i++) {
        await manager.executeMessage(mockClient, message)
      }

      // 4th message should be rejected
      await expect(manager.executeMessage(mockClient, message)).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('createChannelWhitelistMiddleware', () => {
    it('should allow whitelisted channels', async () => {
      const middleware = createChannelWhitelistMiddleware(['chat', 'notifications'])

      const manager = new MiddlewareManager()
      manager.use(middleware)

      // Should not throw for whitelisted channel
      await manager.executeSubscribe(mockClient, 'chat')
    })

    it('should reject non-whitelisted channels', async () => {
      const middleware = createChannelWhitelistMiddleware(['chat', 'notifications'])

      const manager = new MiddlewareManager()
      manager.use(middleware)

      await expect(manager.executeSubscribe(mockClient, 'random')).rejects.toThrow(
        "Channel 'random' is not allowed",
      )
    })

    it('should allow messages to whitelisted channels', async () => {
      const middleware = createChannelWhitelistMiddleware(['chat', 'notifications'])

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      const manager = new MiddlewareManager()
      manager.use(middleware)

      // Should not throw for whitelisted channel
      await manager.executeMessage(mockClient, message)
    })

    it('should reject messages to non-whitelisted channels', async () => {
      const middleware = createChannelWhitelistMiddleware(['chat', 'notifications'])

      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'random',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      const manager = new MiddlewareManager()
      manager.use(middleware)

      await expect(manager.executeMessage(mockClient, message)).rejects.toThrow(
        "Channel 'random' is not allowed",
      )
    })
  })
})
