/**
 * Client Registry Tests
 * Tests for client registration and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClientRegistry } from '../src/registry/index.js'
import { MulticastTransport } from '../src/channel/index.js'
import type {
  IClientConnection,
  IServerTransport,
  Message,
} from '../src/types/index.js'
import { MessageType } from '../src/types/index.js'

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

// Mock transport
function createMockTransport(): IServerTransport {
  const connections = new Map()
  return {
    connections,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  } as any
}

describe('ClientRegistry', () => {
  let registry: ClientRegistry
  let transport: IServerTransport

  beforeEach(() => {
    registry = new ClientRegistry()
    transport = createMockTransport()
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
    it('should register a channel', () => {
      const channel = new MulticastTransport('test', registry.connections)

      registry.registerChannel(channel)

      expect(registry.getChannel('test')).toBe(channel)
    })

    it('should get a channel by name', () => {
      const channel = new MulticastTransport('chat', registry.connections)
      registry.registerChannel(channel)

      const retrieved = registry.getChannel('chat')

      expect(retrieved).toBe(channel)
    })

    it('should return undefined for non-existent channel', () => {
      const channel = registry.getChannel('nonexistent')

      expect(channel).toBeUndefined()
    })

    it('should remove a channel', () => {
      const channel = new MulticastTransport('test', registry.connections)
      registry.registerChannel(channel)

      const result = registry.removeChannel('test')

      expect(result).toBe(true)
      expect(registry.getChannel('test')).toBeUndefined()
    })

    it('should return false when removing non-existent channel', () => {
      const result = registry.removeChannel('nonexistent')

      expect(result).toBe(false)
    })

    it('should get all channel names', () => {
      registry.registerChannel(new MulticastTransport('chat', registry.connections))
      registry.registerChannel(new MulticastTransport('news', registry.connections))
      registry.registerChannel(new MulticastTransport('updates', registry.connections))

      const channels = registry.getChannels()

      expect(channels).toEqual(expect.arrayContaining(['chat', 'news', 'updates']))
      expect(channels).toHaveLength(3)
    })

    it('should return empty array when no channels', () => {
      const channels = registry.getChannels()

      expect(channels).toEqual([])
    })
  })

  describe('subscription management', () => {
    let channel: MulticastTransport<string>

    beforeEach(() => {
      channel = new MulticastTransport('chat', registry.connections)
      registry.registerChannel(channel)
    })

    it('should subscribe a client to a channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.subscribe('client-1', 'chat')

      expect(result).toBe(true)
      expect(channel.hasSubscriber('client-1')).toBe(true)
    })

    it('should return false when subscribing to non-existent channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.subscribe('client-1', 'nonexistent')

      expect(result).toBe(false)
    })

    it('should unsubscribe a client from a channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)
      registry.subscribe('client-1', 'chat')

      const result = registry.unsubscribe('client-1', 'chat')

      expect(result).toBe(true)
      expect(channel.hasSubscriber('client-1')).toBe(false)
    })

    it('should return false when unsubscribing from non-existent channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      const result = registry.unsubscribe('client-1', 'nonexistent')

      expect(result).toBe(false)
    })

    it('should get subscribers for a channel', () => {
      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))

      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-2', 'chat')

      const subscribers = registry.getSubscribers('chat')

      expect(subscribers).toHaveLength(2)
      expect(subscribers.map((c) => c.id)).toEqual(['client-1', 'client-2'])
    })

    it('should return empty array for channel with no subscribers', () => {
      const subscribers = registry.getSubscribers('chat')

      expect(subscribers).toEqual([])
    })

    it('should return empty array for non-existent channel', () => {
      const subscribers = registry.getSubscribers('nonexistent')

      expect(subscribers).toEqual([])
    })

    it('should return 0 for non-existent channel subscriber count', () => {
      expect(registry.getSubscriberCount('nonexistent')).toBe(0)
    })

    it('should return false for isSubscribed on non-existent channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      expect(registry.isSubscribed('client-1', 'nonexistent')).toBe(false)
    })

    it('should get subscriber count for a channel', () => {
      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))

      expect(registry.getSubscriberCount('chat')).toBe(0)

      registry.subscribe('client-1', 'chat')
      expect(registry.getSubscriberCount('chat')).toBe(1)

      registry.subscribe('client-2', 'chat')
      expect(registry.getSubscriberCount('chat')).toBe(2)
    })

    it('should check if client is subscribed to a channel', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      expect(registry.isSubscribed('client-1', 'chat')).toBe(false)

      registry.subscribe('client-1', 'chat')

      expect(registry.isSubscribed('client-1', 'chat')).toBe(true)
    })

    it('should return false for non-existent channel when checking subscription', () => {
      const connection = createMockConnection('client-1')
      registry.register(connection)

      expect(registry.isSubscribed('client-1', 'nonexistent')).toBe(false)
    })
  })

  describe('total subscription count', () => {
    beforeEach(() => {
      registry.registerChannel(new MulticastTransport('chat', registry.connections))
      registry.registerChannel(new MulticastTransport('news', registry.connections))
      registry.registerChannel(new MulticastTransport('updates', registry.connections))

      registry.register(createMockConnection('client-1'))
      registry.register(createMockConnection('client-2'))
      registry.register(createMockConnection('client-3'))
    })

    it('should return 0 initially', () => {
      expect(registry.getTotalSubscriptionCount()).toBe(0)
    })

    it('should count subscriptions across all channels', () => {
      // Subscribe clients to different channels
      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-2', 'chat')

      registry.subscribe('client-1', 'news')
      registry.subscribe('client-3', 'news')

      registry.subscribe('client-2', 'updates')

      // Total: chat=2, news=2, updates=1 = 5
      expect(registry.getTotalSubscriptionCount()).toBe(5)
    })

    it('should update when unsubscribing', () => {
      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-2', 'chat')
      registry.subscribe('client-3', 'chat')

      expect(registry.getTotalSubscriptionCount()).toBe(3)

      registry.unsubscribe('client-1', 'chat')

      expect(registry.getTotalSubscriptionCount()).toBe(2)
    })
  })

  describe('cleanup on client unregister', () => {
    it('should unsubscribe client from all channels when unregistered', () => {
      const chat = new MulticastTransport('chat', registry.connections)
      const news = new MulticastTransport('news', registry.connections)

      registry.registerChannel(chat)
      registry.registerChannel(news)

      const connection = createMockConnection('client-1')
      registry.register(connection)

      // Subscribe to multiple channels
      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-1', 'news')

      expect(chat.hasSubscriber('client-1')).toBe(true)
      expect(news.hasSubscriber('client-1')).toBe(true)

      // Unregister client
      registry.unregister('client-1')

      // Should be unsubscribed from all channels
      expect(chat.hasSubscriber('client-1')).toBe(false)
      expect(news.hasSubscriber('client-1')).toBe(false)
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
      registry.registerChannel(new MulticastTransport('chat', registry.connections))
      registry.registerChannel(new MulticastTransport('news', registry.connections))

      expect(registry.getChannels()).toHaveLength(2)

      registry.clear()

      expect(registry.getChannels()).toEqual([])
    })

    it('should clear all subscriptions', () => {
      const chat = new MulticastTransport('chat', registry.connections)
      registry.registerChannel(chat)

      registry.register(createMockConnection('client-1'))
      registry.subscribe('client-1', 'chat')

      expect(chat.subscriberCount).toBe(1)

      registry.clear()

      expect(chat.subscriberCount).toBe(0)
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
})
