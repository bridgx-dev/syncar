/**
 * ClientRegistry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClientRegistry } from '../client-registry.js'
import type { ServerTransport, ClientConnection } from '@synnel/adapter-ws'
import { MessageType } from '@synnel/core'

// Mock transport
class MockTransport implements ServerTransport {
  public clients: Map<string, ClientConnection> = new Map()

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async sendToClient(): Promise<void> {}
  async broadcast(): Promise<void> {}
  async disconnectClient(clientId: string): Promise<void> {
    this.clients.delete(clientId)
  }
  getClients(): ClientConnection[] {
    return Array.from(this.clients.values())
  }
  getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId)
  }
  getServerInfo(): any {
    return {}
  }
  on(): () => void {
    return () => {}
  }

  // Test helper to add a client
  addClient(id: string): void {
    this.clients.set(id, {
      id,
      status: 'connected',
      connectedAt: Date.now(),
      metadata: {},
    })
  }
}

describe('ClientRegistry', () => {
  let registry: ClientRegistry
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    registry = new ClientRegistry()
  })

  describe('client registration', () => {
    it('should register a new client', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!

      const client = registry.register('client-1', transport, connection)

      expect(client.id).toBe('client-1')
      expect(registry.getCount()).toBe(1)
    })

    it('should unregister a client', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)

      const unregistered = registry.unregister('client-1')

      expect(unregistered).toBe(true)
      expect(registry.getCount()).toBe(0)
    })

    it('should return false when unregistering non-existent client', () => {
      const unregistered = registry.unregister('non-existent')
      expect(unregistered).toBe(false)
    })

    it('should get a client by ID', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)

      const client = registry.get('client-1')

      expect(client).toBeDefined()
      expect(client?.id).toBe('client-1')
    })

    it('should return undefined for non-existent client', () => {
      const client = registry.get('non-existent')
      expect(client).toBeUndefined()
    })

    it('should get all clients', () => {
      for (let i = 1; i <= 3; i++) {
        const id = `client-${i}`
        transport.addClient(id)
        const connection = transport.getClient(id)!
        registry.register(id, transport, connection)
      }

      const clients = registry.getAll()

      expect(clients).toHaveLength(3)
      expect(clients.map((c) => c.id)).toEqual(['client-1', 'client-2', 'client-3'])
    })

    it('should clear all clients', () => {
      for (let i = 1; i <= 3; i++) {
        const id = `client-${i}`
        transport.addClient(id)
        const connection = transport.getClient(id)!
        registry.register(id, transport, connection)
      }

      registry.clear()

      expect(registry.getCount()).toBe(0)
    })
  })

  describe('channel subscriptions', () => {
    it('should subscribe a client to a channel', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)

      const subscribed = registry.subscribe('client-1', 'chat')

      expect(subscribed).toBe(true)
      expect(registry.isSubscribed('client-1', 'chat')).toBe(true)
    })

    it('should unsubscribe a client from a channel', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')

      const unsubscribed = registry.unsubscribe('client-1', 'chat')

      expect(unsubscribed).toBe(true)
      expect(registry.isSubscribed('client-1', 'chat')).toBe(false)
    })

    it('should return false when unsubscribing from non-subscribed channel', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)

      const unsubscribed = registry.unsubscribe('client-1', 'chat')

      expect(unsubscribed).toBe(false)
    })

    it('should get subscribers for a channel', () => {
      for (let i = 1; i <= 3; i++) {
        const id = `client-${i}`
        transport.addClient(id)
        const connection = transport.getClient(id)!
        registry.register(id, transport, connection)
        registry.subscribe(id, 'chat')
      }

      const subscribers = registry.getSubscribers('chat')

      expect(subscribers).toHaveLength(3)
      expect(subscribers.map((s) => s.id)).toEqual(['client-1', 'client-2', 'client-3'])
    })

    it('should get subscriber count for a channel', () => {
      for (let i = 1; i <= 3; i++) {
        const id = `client-${i}`
        transport.addClient(id)
        const connection = transport.getClient(id)!
        registry.register(id, transport, connection)
        registry.subscribe(id, 'chat')
      }

      expect(registry.getSubscriberCount('chat')).toBe(3)
    })

    it('should return 0 for non-existent channel', () => {
      expect(registry.getSubscriberCount('non-existent')).toBe(0)
    })

    it('should get all channels with subscribers', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-1', 'notifications')

      const channels = registry.getChannels()

      expect(channels).toHaveLength(2)
      expect(channels).toContain('chat')
      expect(channels).toContain('notifications')
    })

    it('should get total subscription count', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-1', 'notifications')

      expect(registry.getTotalSubscriptionCount()).toBe(2)
    })

    it('should remove client from channel subscriptions when unregistered', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')

      registry.unregister('client-1')

      expect(registry.getSubscribers('chat')).toHaveLength(0)
    })

    it('should clean up empty channels when last subscriber leaves', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')

      registry.unregister('client-1')

      expect(registry.getChannels()).not.toContain('chat')
    })
  })

  describe('ServerClient wrapper', () => {
    it('should provide send method', async () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      const client = registry.register('client-1', transport, connection)

      const sendSpy = vi.spyOn(transport, 'sendToClient').mockResolvedValue()

      await client.send({ id: 'test', type: MessageType.DATA, timestamp: Date.now() })

      expect(sendSpy).toHaveBeenCalledWith('client-1', expect.any(Object))
    })

    it('should provide disconnect method', async () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      const client = registry.register('client-1', transport, connection)

      await client.disconnect()

      expect(registry.get('client-1')).toBeUndefined()
    })

    it('should provide getSubscriptions method', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      const client = registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')
      registry.subscribe('client-1', 'notifications')

      const subscriptions = client.getSubscriptions()

      expect(subscriptions).toEqual(['chat', 'notifications'])
    })

    it('should provide hasSubscription method', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      const client = registry.register('client-1', transport, connection)
      registry.subscribe('client-1', 'chat')

      expect(client.hasSubscription('chat')).toBe(true)
      expect(client.hasSubscription('notifications')).toBe(false)
    })

    it('should provide setMetadata and getMetadata methods', () => {
      transport.addClient('client-1')
      const connection = transport.getClient('client-1')!
      const client = registry.register('client-1', transport, connection)

      client.setMetadata('userId', 'user-123')
      client.setMetadata('role', 'admin')

      expect(client.getMetadata('userId')).toBe('user-123')
      expect(client.getMetadata('role')).toBe('admin')
      expect(client.getMetadata('nonexistent')).toBeUndefined()
    })
  })
})
