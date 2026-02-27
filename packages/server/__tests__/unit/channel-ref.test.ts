/**
 * ChannelRef Unit Tests
 * Tests for the lightweight channel reference implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChannelRef } from '../../src/channel/channel-ref'
import { HandlerRegistry } from '../../src/registry/handler-registry'
import type {
  IClientConnection,
  IMessageHandler,
  ILifecycleHandler,
  ClientId,
  ChannelName,
  SubscriberId,
} from '../../src/types'
import type { DataMessage } from '../../src/types/message'

// Mock connection
function createMockConnection(id: string): IClientConnection {
  return {
    id,
    socket: {
      send: vi.fn(),
      close: vi.fn(),
    } as any,
    connectedAt: Date.now(),
    lastPingAt: undefined,
  }
}

describe('ChannelRef', () => {
  let handlers: HandlerRegistry
  let subscribers: Set<SubscriberId>
  let connections: Map<SubscriberId, IClientConnection>
  let subscribeFn: vi.Mock<
    (clientId: SubscriberId) => boolean,
    (clientId: SubscriberId) => boolean
  >
  let unsubscribeFn: vi.Mock<
    (clientId: SubscriberId) => boolean,
    (clientId: SubscriberId) => boolean
  >
  let publishFn: vi.Mock
  let channelRef: ChannelRef<string>

  beforeEach(() => {
    subscribers = new Set()
    connections = new Map()
    handlers = new HandlerRegistry()
    subscribeFn = vi.fn((clientId: SubscriberId) => {
      subscribers.add(clientId)
      return true
    })
    unsubscribeFn = vi.fn((clientId: SubscriberId) => {
      subscribers.delete(clientId)
      return true
    })
    publishFn = vi.fn()

    channelRef = new ChannelRef<string>(
      'test-channel' as ChannelName,
      () => subscribers,
      handlers,
      subscribeFn,
      unsubscribeFn,
      publishFn,
    )
  })

  describe('creation', () => {
    it('should create a channel with given name', () => {
      expect(channelRef.name).toBe('test-channel' as ChannelName)
    })

    it('should start with zero subscribers', () => {
      expect(channelRef.subscriberCount).toBe(0)
      expect(channelRef.isEmpty()).toBe(true)
    })
  })

  describe('subscribe', () => {
    it('should delegate subscribe to subscribeFn', () => {
      subscribeFn.mockClear()

      const result = channelRef.subscribe('client-1' as SubscriberId)

      expect(result).toBe(true)
      expect(subscribeFn).toHaveBeenCalledWith('client-1' as SubscriberId)
    })

    it('should return whatever subscribeFn returns', () => {
      subscribeFn.mockReturnValue(false)

      const result = channelRef.subscribe('client-1' as SubscriberId)

      expect(result).toBe(false)
    })
  })

  describe('unsubscribe', () => {
    it('should delegate unsubscribe to unsubscribeFn', () => {
      // First subscribe
      subscribers.add('client-1' as SubscriberId)
      unsubscribeFn.mockClear()

      const result = channelRef.unsubscribe('client-1' as SubscriberId)

      expect(result).toBe(true)
      expect(unsubscribeFn).toHaveBeenCalledWith('client-1' as SubscriberId)
    })

    it('should return whatever unsubscribeFn returns', () => {
      unsubscribeFn.mockReturnValue(false)

      const result = channelRef.unsubscribe('client-1' as SubscriberId)

      expect(result).toBe(false)
    })
  })

  describe('hasSubscriber', () => {
    it('should return true if subscriber exists', () => {
      subscribers.add('client-1' as SubscriberId)

      expect(channelRef.hasSubscriber('client-1' as SubscriberId)).toBe(true)
    })

    it('should return false if subscriber does not exist', () => {
      expect(channelRef.hasSubscriber('client-1' as SubscriberId)).toBe(false)
    })
  })

  describe('getSubscribers', () => {
    beforeEach(() => {
      subscribers.add('client-1' as SubscriberId)
      subscribers.add('client-2' as SubscriberId)
      subscribers.add('client-3' as SubscriberId)
    })

    it('should return a set of subscribers', () => {
      const result = channelRef.getSubscribers()

      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(3)
    })

    it('should return a copy (modifications do not affect original)', () => {
      const result = channelRef.getSubscribers()

      result.add('client-4' as SubscriberId)

      expect(subscribers.size).toBe(3)
      expect(subscribers.has('client-4' as SubscriberId)).toBe(false)
    })

    it('should contain all subscribers', () => {
      const result = channelRef.getSubscribers()

      expect(result.has('client-1' as SubscriberId)).toBe(true)
      expect(result.has('client-2' as SubscriberId)).toBe(true)
      expect(result.has('client-3' as SubscriberId)).toBe(true)
    })
  })

  describe('subscriberCount', () => {
    it('should return the number of subscribers', () => {
      expect(channelRef.subscriberCount).toBe(0)

      subscribers.add('client-1' as SubscriberId)
      expect(channelRef.subscriberCount).toBe(1)

      subscribers.add('client-2' as SubscriberId)
      expect(channelRef.subscriberCount).toBe(2)
    })

    it('should be reactive to changes in subscribers set', () => {
      expect(channelRef.subscriberCount).toBe(0)

      subscribers.add('client-1' as SubscriberId)
      expect(channelRef.subscriberCount).toBe(1)

      subscribers.delete('client-1' as SubscriberId)
      expect(channelRef.subscriberCount).toBe(0)
    })
  })

  describe('isEmpty', () => {
    it('should return true when no subscribers', () => {
      expect(channelRef.isEmpty()).toBe(true)
    })

    it('should return false when there are subscribers', () => {
      subscribers.add('client-1' as SubscriberId)

      expect(channelRef.isEmpty()).toBe(false)
    })

    it('should be reactive to changes in subscribers set', () => {
      expect(channelRef.isEmpty()).toBe(true)

      subscribers.add('client-1' as SubscriberId)
      expect(channelRef.isEmpty()).toBe(false)

      subscribers.delete('client-1' as SubscriberId)
      expect(channelRef.isEmpty()).toBe(true)
    })
  })

  describe('publish', () => {
    it('should delegate publish to publishFn', () => {
      publishFn.mockClear()

      channelRef.publish('Hello world!')

      expect(publishFn).toHaveBeenCalledWith('Hello world!', undefined)
    })

    it('should pass publish options', () => {
      publishFn.mockClear()

      const options = { to: ['client-1'] }
      channelRef.publish('Private message', options)

      expect(publishFn).toHaveBeenCalledWith('Private message', options)
    })
  })

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler: IMessageHandler<string> = vi.fn()

      channelRef.onMessage(handler)

      const registered = handlers.getMessageHandlers('test-channel' as ChannelName)
      expect(registered.size).toBe(1)
    })

    it('should return unsubscribe function', () => {
      const handler: IMessageHandler<string> = vi.fn()

      const unsubscribe = channelRef.onMessage(handler)

      expect(handlers.getMessageHandlers('test-channel' as ChannelName).size).toBe(1)

      unsubscribe()

      expect(handlers.getMessageHandlers('test-channel' as ChannelName).size).toBe(0)
    })
  })

  describe('onSubscribe', () => {
    it('should register subscribe handler', () => {
      const handler: ILifecycleHandler = vi.fn()

      channelRef.onSubscribe(handler)

      const registered = handlers.getSubscribeHandlers('test-channel' as ChannelName)
      expect(registered.size).toBe(1)
    })

    it('should return unsubscribe function', () => {
      const handler: ILifecycleHandler = vi.fn()

      const unsubscribe = channelRef.onSubscribe(handler)

      expect(handlers.getSubscribeHandlers('test-channel' as ChannelName).size).toBe(1)

      unsubscribe()

      expect(handlers.getSubscribeHandlers('test-channel' as ChannelName).size).toBe(0)
    })
  })

  describe('onUnsubscribe', () => {
    it('should register unsubscribe handler', () => {
      const handler: ILifecycleHandler = vi.fn()

      channelRef.onUnsubscribe(handler)

      const registered = handlers.getUnsubscribeHandlers('test-channel' as ChannelName)
      expect(registered.size).toBe(1)
    })

    it('should return unsubscribe function', () => {
      const handler: ILifecycleHandler = vi.fn()

      const unsubscribe = channelRef.onUnsubscribe(handler)

      expect(handlers.getUnsubscribeHandlers('test-channel' as ChannelName).size).toBe(1)

      unsubscribe()

      expect(handlers.getUnsubscribeHandlers('test-channel' as ChannelName).size).toBe(0)
    })
  })

  describe('receive', () => {
    it('should trigger all message handlers', async () => {
      const handler1: IMessageHandler<string> = vi.fn()
      const handler2: IMessageHandler<string> = vi.fn()

      channelRef.onMessage(handler1)
      channelRef.onMessage(handler2)

      const client = createMockConnection('client-1')
      const message: DataMessage<string> = {
        id: 'msg-1',
        type: 'data',
        channel: 'test-channel' as ChannelName,
        data: 'test data',
        timestamp: Date.now(),
      }

      await channelRef.receive('test data', client, message)

      expect(handler1).toHaveBeenCalledWith('test data', client, message)
      expect(handler2).toHaveBeenCalledWith('test data', client, message)
    })

    it('should handle errors in handlers gracefully', async () => {
      const errorHandler = vi.fn()
      const normalHandler: IMessageHandler<string> = vi.fn()

      channelRef.onMessage(async () => {
        throw new Error('Handler error')
      })
      channelRef.onMessage(normalHandler)

      const client = createMockConnection('client-1')
      const message: DataMessage<string> = {
        id: 'msg-1',
        type: 'data',
        channel: 'test-channel' as ChannelName,
        data: 'test data',
        timestamp: Date.now(),
      }

      await channelRef.receive('test data', client, message)

      // Normal handler should still be called
      expect(normalHandler).toHaveBeenCalled()
    })
  })

  describe('handleSubscribe', () => {
    it('should trigger all subscribe handlers', async () => {
      const handler1: ILifecycleHandler = vi.fn()
      const handler2: ILifecycleHandler = vi.fn()

      channelRef.onSubscribe(handler1)
      channelRef.onSubscribe(handler2)

      const client = createMockConnection('client-1')

      await channelRef.handleSubscribe(client)

      expect(handler1).toHaveBeenCalledWith(client)
      expect(handler2).toHaveBeenCalledWith(client)
    })

    it('should throw on handler error to allow blocking subscription', async () => {
      channelRef.onSubscribe(async () => {
        throw new Error('Reject subscription')
      })

      const client = createMockConnection('client-1')

      await expect(channelRef.handleSubscribe(client)).rejects.toThrow('Reject subscription')
    })
  })

  describe('handleUnsubscribe', () => {
    it('should trigger all unsubscribe handlers', async () => {
      const handler1: ILifecycleHandler = vi.fn()
      const handler2: ILifecycleHandler = vi.fn()

      channelRef.onUnsubscribe(handler1)
      channelRef.onUnsubscribe(handler2)

      const client = createMockConnection('client-1')

      await channelRef.handleUnsubscribe(client)

      expect(handler1).toHaveBeenCalledWith(client)
      expect(handler2).toHaveBeenCalledWith(client)
    })

    it('should handle errors in handlers gracefully', async () => {
      const normalHandler: ILifecycleHandler = vi.fn()

      channelRef.onUnsubscribe(async () => {
        throw new Error('Handler error')
      })
      channelRef.onUnsubscribe(normalHandler)

      const client = createMockConnection('client-1')

      // Should not throw - errors are caught and logged
      await channelRef.handleUnsubscribe(client)

      expect(normalHandler).toHaveBeenCalled()
    })
  })
})
