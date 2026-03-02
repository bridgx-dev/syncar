/**
 * Handler Registry Unit Tests
 * Tests for handler registration, removal, and triggering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HandlerRegistry } from '../../src/registry/handler-registry.js'
import type {
  IMessageHandler,
  ILifecycleHandler,
} from '../../src/types/index.js'
import type { ChannelName, ClientId } from '../../src/types/index.js'
import type { IClientConnection } from '../../src/types/index.js'

// Helper to create mock client
function createMockClient(id: ClientId): IClientConnection {
  return {
    id,
    socket: {
      send: vi.fn(),
      close: vi.fn(),
    } as any,
    status: 'connected' as const,
    connectedAt: Date.now(),
  }
}

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry

  beforeEach(() => {
    registry = new HandlerRegistry()
  })

  describe('Message Handlers', () => {
    it('should add and remove message handlers', () => {
      const handler1: IMessageHandler = vi.fn()
      const handler2: IMessageHandler = vi.fn()

      const unsubscribe = registry.addMessageHandler(
        'chat' as ChannelName,
        handler1,
      )

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(1)

      registry.addMessageHandler('chat' as ChannelName, handler2)
      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(2)

      // Remove using unsubscribe function
      unsubscribe()

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(1)
      expect(
        registry.getMessageHandlers('chat' as ChannelName).has(handler1),
      ).toBe(false)

      registry.removeMessageHandler('chat' as ChannelName, handler2)
      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
    })

    it('should return empty set for channel with no handlers', () => {
      const handlers = registry.getMessageHandlers('nonexistent' as ChannelName)

      expect(handlers).toBeInstanceOf(Set)
      expect(handlers.size).toBe(0)
    })

    it('should support multiple channels', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      registry.addMessageHandler('chat' as ChannelName, handler1)
      registry.addMessageHandler('news' as ChannelName, handler2)

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(1)
      expect(registry.getMessageHandlers('news' as ChannelName).size).toBe(1)
    })
  })

  describe('Subscribe Handlers', () => {
    it('should add and remove subscribe handlers', () => {
      const handler1: ILifecycleHandler = vi.fn()
      const handler2: ILifecycleHandler = vi.fn()

      const unsubscribe = registry.addSubscribeHandler(
        'chat' as ChannelName,
        handler1,
      )

      expect(registry.getSubscribeHandlers('chat' as ChannelName).size).toBe(1)

      registry.addSubscribeHandler('chat' as ChannelName, handler2)
      expect(registry.getSubscribeHandlers('chat' as ChannelName).size).toBe(2)

      unsubscribe()

      expect(registry.getSubscribeHandlers('chat' as ChannelName).size).toBe(1)
      expect(
        registry.getSubscribeHandlers('chat' as ChannelName).has(handler1),
      ).toBe(false)

      registry.removeSubscribeHandler('chat' as ChannelName, handler2)
      expect(registry.getSubscribeHandlers('chat' as ChannelName).size).toBe(0)
    })

    it('should return empty set for channel with no handlers', () => {
      const handlers = registry.getSubscribeHandlers(
        'nonexistent' as ChannelName,
      )

      expect(handlers).toBeInstanceOf(Set)
      expect(handlers.size).toBe(0)
    })
  })

  describe('Unsubscribe Handlers', () => {
    it('should add and remove unsubscribe handlers', () => {
      const handler1: ILifecycleHandler = vi.fn()
      const handler2: ILifecycleHandler = vi.fn()

      const unsubscribe = registry.addUnsubscribeHandler(
        'chat' as ChannelName,
        handler1,
      )

      expect(registry.getUnsubscribeHandlers('chat' as ChannelName).size).toBe(
        1,
      )

      registry.addUnsubscribeHandler('chat' as ChannelName, handler2)
      expect(registry.getUnsubscribeHandlers('chat' as ChannelName).size).toBe(
        2,
      )

      unsubscribe()

      expect(registry.getUnsubscribeHandlers('chat' as ChannelName).size).toBe(
        1,
      )
      expect(
        registry.getUnsubscribeHandlers('chat' as ChannelName).has(handler1),
      ).toBe(false)

      registry.removeUnsubscribeHandler('chat' as ChannelName, handler2)
      expect(registry.getUnsubscribeHandlers('chat' as ChannelName).size).toBe(
        0,
      )
    })

    it('should return empty set for channel with no handlers', () => {
      const handlers = registry.getUnsubscribeHandlers(
        'nonexistent' as ChannelName,
      )

      expect(handlers).toBeInstanceOf(Set)
      expect(handlers.size).toBe(0)
    })
  })

  describe('clearChannel', () => {
    it('should remove all handlers for a specific channel', () => {
      const messageHandler: IMessageHandler = vi.fn()
      const subscribeHandler: ILifecycleHandler = vi.fn()
      const unsubscribeHandler: ILifecycleHandler = vi.fn()

      registry.addMessageHandler('chat' as ChannelName, messageHandler)
      registry.addSubscribeHandler('chat' as ChannelName, subscribeHandler)
      registry.addUnsubscribeHandler('chat' as ChannelName, unsubscribeHandler)

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(1)
      expect(registry.getSubscribeHandlers('chat' as ChannelName).size).toBe(1)
      expect(registry.getUnsubscribeHandlers('chat' as ChannelName).size).toBe(
        1,
      )

      registry.clearChannel('chat' as ChannelName)

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
      expect(registry.getSubscribeHandlers('chat' as ChannelName).size).toBe(0)
      expect(registry.getUnsubscribeHandlers('chat' as ChannelName).size).toBe(
        0,
      )
    })

    it('should not affect other channels', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      registry.addMessageHandler('chat' as ChannelName, handler1)
      registry.addMessageHandler('news' as ChannelName, handler2)

      registry.clearChannel('chat' as ChannelName)

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
      expect(registry.getMessageHandlers('news' as ChannelName).size).toBe(1)
    })
  })

  describe('clear', () => {
    it('should remove all handlers from all channels', () => {
      registry.addMessageHandler('chat' as ChannelName, vi.fn())
      registry.addMessageHandler('news' as ChannelName, vi.fn())
      registry.addSubscribeHandler('chat' as ChannelName, vi.fn())
      registry.addUnsubscribeHandler('news' as ChannelName, vi.fn())

      // getHandlerCount only counts message handlers
      expect(registry.getHandlerCount()).toBe(2)

      registry.clear()

      expect(registry.getHandlerCount()).toBe(0)
      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
      expect(registry.getMessageHandlers('news' as ChannelName).size).toBe(0)
    })
  })

  describe('getHandlerCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getHandlerCount()).toBe(0)
    })

    it('should count all message handlers across all channels', () => {
      registry.addMessageHandler('chat' as ChannelName, vi.fn())
      registry.addMessageHandler('chat' as ChannelName, vi.fn())
      registry.addMessageHandler('news' as ChannelName, vi.fn())

      expect(registry.getHandlerCount()).toBe(3)
    })
  })

  describe('getActiveChannels', () => {
    it('should return empty array when no handlers', () => {
      const channels = registry.getActiveChannels()

      expect(Array.isArray(channels)).toBe(true)
      expect(channels.length).toBe(0)
    })

    it('should return channels with handlers', () => {
      registry.addMessageHandler('chat' as ChannelName, vi.fn())
      registry.addSubscribeHandler('news' as ChannelName, vi.fn())

      const channels = registry.getActiveChannels()

      expect(channels.length).toBe(2)
      expect(channels).toContain('chat' as ChannelName)
      expect(channels).toContain('news' as ChannelName)
    })

    it('should not duplicate channels with multiple handler types', () => {
      registry.addMessageHandler('chat' as ChannelName, vi.fn())
      registry.addSubscribeHandler('chat' as ChannelName, vi.fn())
      registry.addUnsubscribeHandler('chat' as ChannelName, vi.fn())

      const channels = registry.getActiveChannels()

      expect(channels.length).toBe(1)
      expect(channels[0]).toBe('chat' as ChannelName)
    })
  })

  describe('Handler Execution', () => {
    it('should call handlers in registration order', async () => {
      const callOrder: string[] = []

      const handler1: IMessageHandler = async () => {
        callOrder.push('handler1')
      }
      const handler2: IMessageHandler = async () => {
        callOrder.push('handler2')
      }
      const handler3: IMessageHandler = async () => {
        callOrder.push('handler3')
      }

      registry.addMessageHandler('chat' as ChannelName, handler1)
      registry.addMessageHandler('chat' as ChannelName, handler2)
      registry.addMessageHandler('chat' as ChannelName, handler3)

      const handlers = registry.getMessageHandlers('chat' as ChannelName)

      // Execute handlers
      for (const handler of handlers) {
        await handler()
      }

      expect(callOrder).toEqual(['handler1', 'handler2', 'handler3'])
    })

    it('should handle handler errors gracefully', async () => {
      const errorHandler = vi.fn()

      const handler1: IMessageHandler = async () => {
        throw new Error('Handler error')
      }
      const handler2: IMessageHandler = async () => {
        errorHandler('called')
      }

      registry.addMessageHandler('chat' as ChannelName, handler1)
      registry.addMessageHandler('chat' as ChannelName, handler2)

      const handlers = registry.getMessageHandlers('chat' as ChannelName)

      // Execute handlers (errors shouldn't stop execution)
      for (const handler of handlers) {
        try {
          await handler()
        } catch {
          // Error in handler1
        }
      }

      expect(errorHandler).toHaveBeenCalledWith('called')
    })
  })

  describe('Unsubscribe Function', () => {
    it('should return function that removes handler', () => {
      const handler: IMessageHandler = vi.fn()

      const unsubscribe = registry.addMessageHandler(
        'chat' as ChannelName,
        handler,
      )

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(1)

      unsubscribe()

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
    })

    it('should not affect other handlers when unsubscribing', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const unsubscribe1 = registry.addMessageHandler(
        'chat' as ChannelName,
        handler1,
      )
      const unsubscribe2 = registry.addMessageHandler(
        'chat' as ChannelName,
        handler2,
      )

      unsubscribe1()

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(1)
      expect(
        registry.getMessageHandlers('chat' as ChannelName).has(handler1),
      ).toBe(false)
      expect(
        registry.getMessageHandlers('chat' as ChannelName).has(handler2),
      ).toBe(true)

      unsubscribe2()

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
    })

    it('should be idempotent - calling unsubscribe multiple times is safe', () => {
      const handler = vi.fn()
      const unsubscribe = registry.addMessageHandler(
        'chat' as ChannelName,
        handler,
      )

      unsubscribe()
      unsubscribe()
      unsubscribe() // Should not error

      expect(registry.getMessageHandlers('chat' as ChannelName).size).toBe(0)
    })
  })
})
