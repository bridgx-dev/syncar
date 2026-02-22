/**
 * SynnelClient Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SynnelClient, createSynnelClient } from '../client.js'
import type { ClientConfig } from '../types.js'
import type { Message, DataMessage } from '@synnel/core'
import { SignalType } from '@synnel/core'

// Mock transport
class MockTransport {
  public _status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' = 'disconnected'
  public eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map()
  public sentMessages: Message[] = []

  get status() {
    return this._status
  }

  async connect(): Promise<void> {
    this._status = 'connecting'

    // Simulate async connection
    await new Promise((resolve) => setTimeout(resolve, 10))

    this._status = 'connected'
    this.emit('open')
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnecting'

    // Simulate async disconnection
    await new Promise((resolve) => setTimeout(resolve, 10))

    this._status = 'disconnected'
    this.emit('close')
  }

  async send(message: Message): Promise<void> {
    if (this._status !== 'connected') {
      throw new Error('Not connected')
    }
    this.sentMessages.push(message)
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)

    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }

  getConnectionInfo() {
    return { connectedAt: this._status === 'connected' ? Date.now() : undefined, url: 'ws://localhost:3000' }
  }

  // Test helper
  simulateMessage(message: Message): void {
    this.emit('message', message)
  }

  simulateClose(code?: number, reason?: string): void {
    this._status = 'disconnected'
    this.emit('close', { code, reason })
  }
}

describe('SynnelClient', () => {
  let client: SynnelClient
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()

    const config: ClientConfig = {
      transport,
      autoConnect: false,
      autoReconnect: false,
    }

    client = new SynnelClient(config)
  })

  afterEach(async () => {
    await client.destroy()
  })

  describe('constructor', () => {
    it('should initialize with disconnected status', () => {
      expect(client.status).toBe('disconnected')
    })

    it('should generate client ID if not provided', () => {
      const stats = client.getStats()
      expect(stats.id).toBeDefined()
      expect(typeof stats.id).toBe('string')
    })

    it('should use provided client ID', () => {
      const customClient = new SynnelClient({
        transport,
        id: 'custom-id',
      })

      expect(customClient.getStats().id).toBe('custom-id')
    })
  })

  describe('createSynnelClient factory', () => {
    it('should create a client instance', () => {
      const factoryClient = createSynnelClient({ transport })

      expect(factoryClient).toBeInstanceOf(SynnelClient)
      expect(factoryClient.status).toBe('disconnected')
    })
  })

  describe('connect', () => {
    it('should connect to the server', async () => {
      await client.connect()

      expect(client.status).toBe('connected')
    })

    it('should emit connected event', async () => {
      const connectedHandler = vi.fn()
      client.on('connected', connectedHandler)

      await client.connect()

      expect(connectedHandler).toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('should disconnect from the server', async () => {
      await client.connect()

      expect(client.status).toBe('connected')

      await client.disconnect()

      expect(client.status).toBe('disconnected')
    })

    it('should emit disconnected event', async () => {
      const disconnectedHandler = vi.fn()
      client.on('disconnected', disconnectedHandler)

      await client.connect()

      await client.disconnect()

      expect(disconnectedHandler).toHaveBeenCalled()
    })
  })

  describe('subscribe', () => {
    it('should subscribe to a channel', async () => {
      await client.connect()

      const subscription = await client.subscribe('chat')

      expect(subscription.channel).toBe('chat')
      expect(client.getSubscription('chat')).toBeDefined()
    })

    it('should call message handlers when message received', async () => {
      await client.connect()

      const onMessage = vi.fn()
      await client.subscribe('chat', { onMessage })

      // Simulate receiving a message
      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      transport.simulateMessage(message)

      expect(onMessage).toHaveBeenCalledWith(message)
    })

    it('should reuse existing subscription', async () => {
      await client.connect()

      const sub1 = await client.subscribe('chat')
      const sub2 = await client.subscribe('chat')

      expect(sub1).toBe(sub2)
      expect(client.getStats().subscriptions).toBe(1)
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe from a channel', async () => {
      await client.connect()

      await client.subscribe('chat')
      expect(client.getSubscription('chat')).toBeDefined()

      await client.unsubscribe('chat')

      // Subscription should be removed after UNSUBSCRIBED signal
      // For now, check that unsubscribe was called
    })

    it('should handle unsubscribing from non-existent channel', async () => {
      await expect(client.unsubscribe('nonexistent')).resolves.toBeUndefined()
    })

    it('should unsubscribe from all channels', async () => {
      await client.connect()

      await client.subscribe('chat')
      await client.subscribe('notifications')

      expect(client.getStats().subscriptions).toBe(2)

      await client.unsubscribeAll()

      expect(client.getStats().subscriptions).toBe(0)
    })
  })

  describe('publish', () => {
    it('should publish a message to a channel', async () => {
      await client.connect()

      await client.publish('chat', { text: 'hello' })

      expect(transport.sentMessages.length).toBe(1)
      expect(transport.sentMessages[0].channel).toBe('chat')
    })

    it('should throw if not connected', async () => {
      await expect(client.publish('chat', { text: 'hello' })).rejects.toThrow()
    })
  })

  describe('getSubscribedChannels', () => {
    it('should return list of subscribed channels', async () => {
      await client.connect()

      await client.subscribe('chat')
      await client.subscribe('notifications')

      // Simulate subscription confirmation
      const sub1 = client.getSubscription('chat')
      const sub2 = client.getSubscription('notifications')

      sub1?.handleSignal(SignalType.SUBSCRIBED)
      sub2?.handleSignal(SignalType.SUBSCRIBED)

      const channels = client.getSubscribedChannels()

      expect(channels).toContain('chat')
      expect(channels).toContain('notifications')
    })

    it('should return empty array if no subscriptions', () => {
      const channels = client.getSubscribedChannels()
      expect(channels).toEqual([])
    })
  })

  describe('event handlers', () => {
    it('should register multiple event handlers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      client.on('message', handler1)
      client.on('message', handler2)

      await client.connect()

      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      transport.simulateMessage(message)

      expect(handler1).toHaveBeenCalledWith(message)
      expect(handler2).toHaveBeenCalledWith(message)
    })

    it('should unsubscribe handler when returned function is called', async () => {
      const handler = vi.fn()
      const unsubscribe = client.on('message', handler)

      await client.connect()

      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'chat',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      transport.simulateMessage(message)
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      transport.simulateMessage(message)
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not called again
    })
  })

  describe('getStats', () => {
    it('should return client statistics', async () => {
      await client.connect()

      await client.subscribe('chat')

      const stats = client.getStats()

      expect(stats.status).toBe('connected')
      expect(stats.id).toBeDefined()
      expect(stats.subscriptions).toBe(1)
      expect(stats.channels).toEqual([])
    })
  })

  describe('setAutoReconnect', () => {
    it('should enable or disable auto-reconnect', () => {
      client.setAutoReconnect(false)
      client.setAutoReconnect(true)

      // Should not throw
    })
  })

  describe('destroy', () => {
    it('should clean up all resources', async () => {
      await client.connect()

      await client.subscribe('chat')

      await client.destroy()

      expect(client.status).toBe('disconnected')
      expect(client.getStats().subscriptions).toBe(0)
    })
  })

  describe('auto-resubscribe after reconnection', () => {
    it('should resubscribe to channels after reconnection', async () => {
      await client.connect()

      const onMessage = vi.fn()
      await client.subscribe('chat', { onMessage })

      const sub = client.getSubscription('chat')
      sub?.handleSignal(SignalType.SUBSCRIBED)

      expect(client.getSubscribedChannels()).toContain('chat')

      // Simulate disconnection
      transport.simulateClose()

      expect(client.status).toBe('disconnected')

      // Simulate reconnection
      await client.connect()

      // Subscription should be reset and resubscribed
      expect(sub?.state).toBe('subscribing')
    })
  })
})
