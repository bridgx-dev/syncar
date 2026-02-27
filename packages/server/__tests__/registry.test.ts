/**
 * Client Registry Tests
 * Tests for client registration and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClientRegistry } from '../src/registry/index.js'
import type {
  IClientConnection,
  ClientId,
  ChannelName,
} from '../src/types/index.js'

// Mock connection
function createMockConnection(id: string): IClientConnection {
  return {
    id,
    socket: {
      send: vi.fn((_data: string, cb?: (err?: Error) => void) => {
        cb?.()
      }),
      close: vi.fn(),
    } as any,
    connectedAt: Date.now(),
    lastPingAt: undefined,
  }
}

describe('ClientRegistry', () => {
  let registry: ClientRegistry

  beforeEach(() => {
    registry = new ClientRegistry()
  })

  describe('client registration', () => {
    it('should register a new client', () => {
      const connection = createMockConnection('client-1')
      const client = registry.register(connection)

      expect(client).toBeDefined()
      expect(client.id).toBe('client-1')
      expect(client.connectedAt).toBe(connection.connectedAt)
    })

    it('should return the same connection for duplicate registration', () => {
      const connection = createMockConnection('client-1')
      const client1 = registry.register(connection)
      const client2 = registry.register(connection)

      expect(client1).toBe(connection)
      expect(client2).toBe(connection)
      expect(registry.getCount()).toBe(1)
    })

    it('should unregister a client', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.unregister('client-1')

      expect(result).toBe(true)
      expect(registry.get('client-1')).toBeUndefined()
      expect(registry.getCount()).toBe(0)
    })

    it('should return false when unregistering non-existent client', () => {
      const result = registry.unregister('client-1')

      expect(result).toBe(false)
    })

    it('should get a client by ID', () => {
      const connection = createMockConnection('client-1')
      const registeredClient = registry.register(connection)

      const client = registry.get('client-1')

      expect(client).toBeDefined()
      expect(client?.id).toBe('client-1')
    })

    it('should return undefined for non-existent client', () => {
      const client = registry.get('client-1')

      expect(client).toBeUndefined()
    })

    it('should get all registered clients', () => {
      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))
      registry.register(createMockConnection('client-3'))

      const clients = registry.getAll()

      expect(clients).toHaveLength(3)
      expect(clients.map((c) => c.id)).toEqual([
        'client-1',
        'client-2',
        'client-3',
      ])
    })

    it('should return empty array when no clients registered', () => {
      const clients = registry.getAll()

      expect(clients).toEqual([])
    })

    it('should return correct client count', () => {
      expect(registry.getCount()).toBe(0)

      registry.register(createMockConnection('client-1'))
      expect(registry.getCount()).toBe(1)

      registry.register(createMockConnection('client-2'))
      expect(registry.getCount()).toBe(2)
    })
  })

  describe('channel management', () => {
    it('should register a channel by name', () => {
      registry.registerChannelByName('test' as ChannelName)

      const channels = registry.getChannels()
      expect(channels).toContain('test' as ChannelName)
    })

    it('should register multiple channels', () => {
      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('news' as ChannelName)
      registry.registerChannelByName('updates' as ChannelName)

      const channels = registry.getChannels()

      expect(channels).toEqual(expect.arrayContaining(['chat', 'news', 'updates'] as ChannelName[]))
      expect(channels).toHaveLength(3)
    })

    it('should not duplicate channels', () => {
      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('chat' as ChannelName)

      const channels = registry.getChannels()
      expect(channels).toHaveLength(1)
    })

    it('should remove a channel', () => {
      registry.registerChannelByName('test' as ChannelName)

      const result = registry.removeChannel('test' as ChannelName)

      expect(result).toBe(true)
      expect(registry.getChannels()).not.toContain('test' as ChannelName)
    })

    it('should return false when removing non-existent channel', () => {
      const result = registry.removeChannel('nonexistent' as ChannelName)

      expect(result).toBe(false)
    })

    it('should return empty array when no channels', () => {
      const channels = registry.getChannels()

      expect(channels).toEqual([])
    })

    it('should get channel subscribers as Set', () => {
      registry.registerChannelByName('chat' as ChannelName)

      const subscribers = registry.getChannelSubscribers('chat' as ChannelName)
      expect(subscribers).toBeInstanceOf(Set)
      expect(subscribers.size).toBe(0)
    })
  })

  describe('subscription management', () => {
    beforeEach(() => {
      registry.registerChannelByName('chat' as ChannelName)
    })

    it('should subscribe a client to a channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(result).toBe(true)
      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(true)
    })

    it('should return false when subscribing non-existent client', () => {
      const result = registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(result).toBe(false)
    })

    it('should create channel if not exists when subscribing', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.subscribe('client-1' as ClientId, 'new-channel' as ChannelName)

      expect(result).toBe(true)
      expect(registry.getChannels()).toContain('new-channel' as ChannelName)
    })

    it('should return false when already subscribed', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      const result = registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(result).toBe(false)
    })

    it('should unsubscribe a client from a channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      const result = registry.unsubscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(result).toBe(true)
      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(false)
    })

    it('should return false when unsubscribing from non-existent channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.unsubscribe('client-1' as ClientId, 'nonexistent' as ChannelName)

      expect(result).toBe(false)
    })

    it('should return false when unsubscribing non-subscribed client', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.unsubscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(result).toBe(false)
    })

    it('should get subscribers for a channel', () => {
      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-2' as ClientId, 'chat' as ChannelName)

      const subscribers = registry.getSubscribers('chat' as ChannelName)

      expect(subscribers).toHaveLength(2)
      expect(subscribers.map((c) => c.id)).toEqual(['client-1', 'client-2'])
    })

    it('should return empty array for channel with no subscribers', () => {
      const subscribers = registry.getSubscribers('chat' as ChannelName)

      expect(subscribers).toEqual([])
    })

    it('should return empty array for non-existent channel', () => {
      const subscribers = registry.getSubscribers('nonexistent' as ChannelName)

      expect(subscribers).toEqual([])
    })

    it('should return 0 for non-existent channel subscriber count', () => {
      expect(registry.getSubscriberCount('nonexistent' as ChannelName)).toBe(0)
    })

    it('should get subscriber count for a channel', () => {
      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))

      expect(registry.getSubscriberCount('chat' as ChannelName)).toBe(0)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      expect(registry.getSubscriberCount('chat' as ChannelName)).toBe(1)

      registry.subscribe('client-2' as ClientId, 'chat' as ChannelName)
      expect(registry.getSubscriberCount('chat' as ChannelName)).toBe(2)
    })

    it('should check if client is subscribed to a channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(false)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(true)
    })

    it('should return false for non-existent channel when checking subscription', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      expect(registry.isSubscribed('client-1' as ClientId, 'nonexistent' as ChannelName)).toBe(false)
    })

    it('should get client channels', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('news' as ChannelName)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-1' as ClientId, 'news' as ChannelName)

      const channels = registry.getClientChannels('client-1' as ClientId)

      expect(channels.size).toBe(2)
      expect(channels.has('chat' as ChannelName)).toBe(true)
      expect(channels.has('news' as ChannelName)).toBe(true)
    })

    it('should return empty set for client with no subscriptions', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const channels = registry.getClientChannels('client-1' as ClientId)

      expect(channels.size).toBe(0)
    })
  })

  describe('bidirectional index consistency', () => {
    it('should maintain consistency when subscribing', () => {
      registry.registerChannelByName('chat' as ChannelName)

      const connection = createMockConnection('client-1')
      registry.register(connection)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      // Check forward index (client → channels)
      expect(registry.getClientChannels('client-1' as ClientId).has('chat' as ChannelName)).toBe(true)

      // Check reverse index (channel → subscribers)
      expect(registry.getChannelSubscribers('chat' as ChannelName).has('client-1' as ClientId)).toBe(true)

      // Check isSubscribed (uses reverse index)
      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(true)
    })

    it('should maintain consistency when unsubscribing', () => {
      registry.registerChannelByName('chat' as ChannelName)

      const connection = createMockConnection('client-1')
      registry.register(connection)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.unsubscribe('client-1' as ClientId, 'chat' as ChannelName)

      // Check forward index
      expect(registry.getClientChannels('client-1' as ClientId).has('chat' as ChannelName)).toBe(false)

      // Check reverse index
      expect(registry.getChannelSubscribers('chat' as ChannelName).has('client-1' as ClientId)).toBe(false)

      // Check isSubscribed
      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(false)
    })

    it('should clean up empty subscription sets', () => {
      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('news' as ChannelName)

      const connection = createMockConnection('client-1')
      registry.register(connection)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-1' as ClientId, 'news' as ChannelName)

      // Unsubscribe from one channel
      registry.unsubscribe('client-1' as ClientId, 'chat' as ChannelName)

      // Should still have the other channel
      expect(registry.getClientChannels('client-1' as ClientId).has('news' as ChannelName)).toBe(true)

      // Unsubscribe from last channel
      registry.unsubscribe('client-1' as ClientId, 'news' as ChannelName)

      // Subscription set should be removed
      const channels = registry.getClientChannels('client-1' as ClientId)
      expect(channels.size).toBe(0)
    })
  })

  describe('total subscription count', () => {
    beforeEach(() => {
      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('news' as ChannelName)
      registry.registerChannelByName('updates' as ChannelName)

      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))
      registry.register(createMockConnection('client-3'))
    })

    it('should return 0 initially', () => {
      expect(registry.getTotalSubscriptionCount()).toBe(0)
    })

    it('should count subscriptions across all channels', () => {
      // Subscribe clients to different channels
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-2' as ClientId, 'chat' as ChannelName)

      registry.subscribe('client-1' as ClientId, 'news' as ChannelName)
      registry.subscribe('client-3' as ClientId, 'news' as ChannelName)

      registry.subscribe('client-2' as ClientId, 'updates' as ChannelName)

      // Total: chat=2, news=2, updates=1 = 5
      expect(registry.getTotalSubscriptionCount()).toBe(5)
    })

    it('should update when unsubscribing', () => {
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-2' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-3' as ClientId, 'chat' as ChannelName)

      expect(registry.getTotalSubscriptionCount()).toBe(3)

      registry.unsubscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(registry.getTotalSubscriptionCount()).toBe(2)
    })
  })

  describe('cleanup on client unregister', () => {
    it('should unsubscribe client from all channels when unregistered', () => {
      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('news' as ChannelName)

      const connection = createMockConnection('client-1')
      registry.register(connection)

      // Subscribe to multiple channels
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-1' as ClientId, 'news' as ChannelName)

      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(true)
      expect(registry.isSubscribed('client-1' as ClientId, 'news' as ChannelName)).toBe(true)

      // Unregister client
      registry.unregister('client-1' as ClientId)

      // Should be unsubscribed from all channels
      expect(registry.isSubscribed('client-1' as ClientId, 'chat' as ChannelName)).toBe(false)
      expect(registry.isSubscribed('client-1' as ClientId, 'news' as ChannelName)).toBe(false)

      // Client channels should be empty
      expect(registry.getClientChannels('client-1' as ClientId).size).toBe(0)
    })

    it('should use subscriptions map for efficient cleanup', () => {
      // Create 10 channels but only subscribe to 2
      for (let i = 0; i < 10; i++) {
        registry.registerChannelByName(`channel-${i}` as ChannelName)
      }

      const connection = createMockConnection('client-1')
      registry.register(connection)

      // Only subscribe to 2 channels
      registry.subscribe('client-1' as ClientId, 'channel-0' as ChannelName)
      registry.subscribe('client-1' as ClientId, 'channel-1' as ChannelName)

      // Unregister should only clean up the 2 subscribed channels
      // (not iterate through all 10)
      registry.unregister('client-1' as ClientId)

      expect(registry.isSubscribed('client-1' as ClientId, 'channel-0' as ChannelName)).toBe(false)
      expect(registry.isSubscribed('client-1' as ClientId, 'channel-1' as ChannelName)).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all clients', () => {
      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))

      expect(registry.getCount()).toBe(2)

      registry.clear()

      expect(registry.getCount()).toBe(0)
      expect(registry.getAll()).toEqual([])
    })

    it('should clear all channels', () => {
      registry.registerChannelByName('chat' as ChannelName)
      registry.registerChannelByName('news' as ChannelName)

      expect(registry.getChannels()).toHaveLength(2)

      registry.clear()

      expect(registry.getChannels()).toEqual([])
    })

    it('should clear all subscriptions', () => {
      registry.registerChannelByName('chat' as ChannelName)

      registry.register(createMockConnection('client-1'))
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(registry.getSubscriberCount('chat' as ChannelName)).toBe(1)

      registry.clear()

      expect(registry.getSubscriberCount('chat' as ChannelName)).toBe(0)
      expect(registry.getTotalSubscriptionCount()).toBe(0)
    })

    it('should clear all handlers', () => {
      const handler = vi.fn()
      registry.handlers.addMessageHandler('test' as ChannelName, handler)

      expect(registry.handlers.getHandlerCount()).toBe(1)

      registry.clear()

      expect(registry.handlers.getHandlerCount()).toBe(0)
    })
  })

  describe('shared connections map', () => {
    it('should provide access to shared connections map containing connections', () => {
      const connection = createMockConnection('client-1')
      const client = registry.register(connection)

      expect(registry.connections.has('client-1')).toBe(true)
      expect(registry.connections.get('client-1')).toBe(connection)
      expect(client).toBe(connection)
    })
  })

  describe('handler registry integration', () => {
    it('should expose handler registry', () => {
      expect(registry.handlers).toBeDefined()
    })

    it('should trigger subscribe handlers when subscribing', () => {
      const handler = vi.fn()
      registry.registerChannelByName('chat' as ChannelName)

      registry.handlers.addSubscribeHandler('chat' as ChannelName, handler)

      const connection = createMockConnection('client-1')
      registry.register(connection)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(handler).toHaveBeenCalledWith(connection)
    })

    it('should trigger unsubscribe handlers when unsubscribing', () => {
      const handler = vi.fn()
      registry.registerChannelByName('chat' as ChannelName)

      registry.handlers.addUnsubscribeHandler('chat' as ChannelName, handler)

      const connection = createMockConnection('client-1')
      registry.register(connection)
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      registry.unsubscribe('client-1' as ClientId, 'chat' as ChannelName)

      expect(handler).toHaveBeenCalledWith(connection)
    })

    it('should trigger unsubscribe handlers when unregistering', () => {
      const handler = vi.fn()
      registry.registerChannelByName('chat' as ChannelName)

      registry.handlers.addUnsubscribeHandler('chat' as ChannelName, handler)

      const connection = createMockConnection('client-1')
      registry.register(connection)
      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)

      registry.unregister('client-1' as ClientId)

      expect(handler).toHaveBeenCalledWith(connection)
    })
  })

  describe('removeChannel', () => {
    it('should remove channel from all client subscriptions', () => {
      registry.registerChannelByName('chat' as ChannelName)

      const client1 = createMockConnection('client-1')
      const client2 = createMockConnection('client-2')

      registry.register(client1)
      registry.register(client2)

      registry.subscribe('client-1' as ClientId, 'chat' as ChannelName)
      registry.subscribe('client-2' as ClientId, 'chat' as ChannelName)

      // Verify subscriptions
      expect(registry.getClientChannels('client-1' as ClientId).has('chat' as ChannelName)).toBe(true)
      expect(registry.getClientChannels('client-2' as ClientId).has('chat' as ChannelName)).toBe(true)

      // Remove channel
      registry.removeChannel('chat' as ChannelName)

      // Check subscriptions are cleaned up
      expect(registry.getClientChannels('client-1' as ClientId).has('chat' as ChannelName)).toBe(false)
      expect(registry.getClientChannels('client-2' as ClientId).has('chat' as ChannelName)).toBe(false)
    })

    it('should clear handlers for removed channel', () => {
      registry.registerChannelByName('chat' as ChannelName)

      const handler = vi.fn()
      registry.handlers.addMessageHandler('chat' as ChannelName, handler)

      expect(registry.handlers.getMessageHandlers('chat' as ChannelName).size).toBe(1)

      registry.removeChannel('chat' as ChannelName)

      expect(registry.handlers.getMessageHandlers('chat' as ChannelName).size).toBe(0)
    })
  })
})
