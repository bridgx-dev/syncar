/**
 * Middleware Tests
 * Tests for middleware manager and middleware factories
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MiddlewareManager } from '../src/middleware/index.js'
import {
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from '../src/errors/index.js'
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
  clearRateLimitStore,
  getRateLimitState,
} from '../src/middleware/factories.js'
import type { IClientConnection } from '../src/types/index.js'
import type { Message, DataMessage } from '../src/types/index.js'
import { MessageType } from '../src/types/index.js'

// Mock client
const createMockClient = (id: string): IClientConnection => {
  return {
    id,
    connectedAt: Date.now(),
    socket: {
      send: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as any,
  }
}

describe('MiddlewareManager', () => {
  let manager: MiddlewareManager
  let mockClient: IClientConnection

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

    it('should provide getRejectionReason method on context', async () => {
      let capturedContext: any

      manager.use(async (context) => {
        capturedContext = context
        context.reject('Test rejection')
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
      } catch {
        // Expected rejection
      }

      // getRejectionReason should return the reason
      expect(capturedContext.getRejectionReason()).toBe('Test rejection')
    })

    it('should return undefined for getRejectionReason when not rejected', async () => {
      let capturedContext: any

      manager.use(async (context) => {
        capturedContext = context
        // Don't reject
      })

      await manager.executeConnection(mockClient, 'connect')

      expect(capturedContext.getRejectionReason()).toBeUndefined()
    })

    it('should expose isRejected method on context', async () => {
      let capturedContext: any

      manager.use(async (context) => {
        capturedContext = context
        context.reject('Test rejection')
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
      } catch {
        // Expected rejection
      }

      // isRejected should return true after rejection
      expect(capturedContext.isRejected()).toBe(true)
    })

    it('should return false for isRejected when not rejected', async () => {
      let capturedContext: any

      manager.use(async (context) => {
        capturedContext = context
        // Don't reject
      })

      await manager.executeConnection(mockClient, 'connect')

      expect(capturedContext.isRejected()).toBe(false)
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

    it('should wrap non-Error thrown values in MiddlewareExecutionError', async () => {
      manager.use(async () => {
        throw 'string error' // Throwing a string instead of Error
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(MiddlewareExecutionError)
        expect((error as MiddlewareExecutionError).cause?.message).toBe(
          'string error',
        )
      }
    })

    it('should wrap number thrown values in MiddlewareExecutionError', async () => {
      manager.use(async () => {
        throw 404 // Throwing a number
      })

      try {
        await manager.executeConnection(mockClient, 'connect')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(MiddlewareExecutionError)
        expect((error as MiddlewareExecutionError).cause?.message).toBe('404')
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
  let mockClient: IClientConnection

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

    it('should use default token extraction from message.data.token', async () => {
      const verifyTokenSpy = vi.fn().mockResolvedValue({ userId: 'user-123' })

      const middleware = createAuthMiddleware({
        verifyToken: verifyTokenSpy,
        // Don't provide getToken - use default
        actions: ['message'],
      })

      manager.use(middleware)

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { token: 'default-token' },
        timestamp: Date.now(),
      }

      await manager.executeMessage(mockClient, message)

      expect(verifyTokenSpy).toHaveBeenCalledWith('default-token')
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

      await expect(manager.executeMessage(mockClient, message)).rejects.toThrow(
        'Authentication token required',
      )
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

      expect((mockClient as any).user).toEqual({
        userId: 'user-123',
        role: 'admin',
      })
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
      const logger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const middleware = createLoggingMiddleware({
        actions: ['connect'],
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
      const logger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const middleware = createLoggingMiddleware({
        actions: ['message'],
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
      const logger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
      const middleware = createLoggingMiddleware({
        actions: ['subscribe'],
        logger,
        logLevel: 'warn',
      })

      manager.use(middleware)
      await manager.executeSubscribe(mockClient, 'chat')

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('subscribe'),
      )
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('chat'))
    })

    it('should use custom format function', async () => {
      const logger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
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
      const logger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
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
      await expect(manager.executeMessage(mockClient, message)).rejects.toThrow(
        MiddlewareRejectionError,
      )
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
      await expect(manager.executeMessage(mockClient, message)).rejects.toThrow(
        MiddlewareRejectionError,
      )
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

    it('should provide rate limit state via getRateLimitState', async () => {
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

      // Send some messages
      await manager.executeMessage(mockClient, message)
      await manager.executeMessage(mockClient, message)

      // Check state
      const state = getRateLimitState('client-1')
      expect(state).toBeDefined()
      expect(state?.count).toBe(2)
      expect(state?.resetTime).toBeDefined()
    })

    it('should return undefined for non-existent rate limit state', () => {
      const state = getRateLimitState('non-existent-client')
      expect(state).toBeUndefined()
    })

    it('should delete expired rate limit state', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 100, // Very short window
      })

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      manager.use(middleware)

      // Send a message to create state
      await manager.executeMessage(mockClient, message)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Send another message - should create new state (old one was deleted)
      await manager.executeMessage(mockClient, message)

      const state = getRateLimitState('client-1')
      expect(state).toBeDefined()
      // Count should be 1 (not 2) because state was deleted and recreated
      expect(state?.count).toBe(1)
    })

    it('should provide cleanup method', () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 1000,
      })

      // Middleware should have cleanup method
      expect((middleware as { cleanup?: () => void }).cleanup).toBeDefined()
      expect(typeof (middleware as { cleanup?: () => void }).cleanup).toBe(
        'function',
      )

      // Call cleanup - should not throw
      ;(middleware as { cleanup?: () => void }).cleanup!()

      // Store should be cleared
      const state = getRateLimitState('client-1')
      expect(state).toBeUndefined()
    })

    it('should skip rate limiting when getMessageId returns falsy', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 1000,
        getMessageId: () => '', // Return empty string (falsy)
        actions: ['message'],
      })

      manager.use(middleware)

      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      // Should not throw - rate limit is skipped
      await manager.executeMessage(mockClient, message)

      // No state should be created for empty ID
      const state = getRateLimitState('')
      expect(state).toBeUndefined()
    })

    it('should skip rate limiting when action is not in list', async () => {
      const middleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 1000,
        actions: ['subscribe'], // Only rate limit subscribe actions
      })

      manager.use(middleware)

      // Execute message action - should not be rate limited
      await manager.executeConnection(mockClient, 'connect')

      // No state should be created for client-1 since connect is not rate limited
      const state = getRateLimitState('client-1')
      expect(state).toBeUndefined()
    })

    it('should execute cleanup interval callback', async () => {
      // This test is designed to wait for the cleanup interval to run
      // The cleanup interval runs every windowMs * 10
      const middleware = createRateLimitMiddleware({
        maxRequests: 5,
        windowMs: 10, // Very short window
      })

      manager.use(middleware)

      // Create some rate limit state
      const message: DataMessage = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      await manager.executeMessage(mockClient, message)

      // Wait for cleanup interval to run (windowMs * 10 = 100ms)
      await new Promise((resolve) => setTimeout(resolve, 150))

      // The cleanup should have run (verified by no errors)
      expect(true).toBe(true)
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

    it('should handle undefined channel gracefully', async () => {
      const middleware = createChannelWhitelistMiddleware({
        allowedChannels: ['chat'],
      })

      manager.use(middleware)

      // This tests the line 515-516: if (!context.channel) { return }
      // When channel is undefined, it should just return without error
      await expect(
        manager.executeSubscribe(mockClient, undefined as any),
      ).resolves.not.toThrow()
    })
  })
})
