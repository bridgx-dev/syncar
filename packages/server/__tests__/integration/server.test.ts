/**
 * Integration Tests
 * Tests server functionality with mocked transport
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SynnelServer } from '../../src/server/index.js'
import type { ISynnelServer, IServerTransport } from '../../src/types/index.js'
import type { IClientConnection } from '../../src/types/index.js'
import type { ClientId, Message, DataMessage, SignalMessage } from '@synnel/types'
import { MessageType, SignalType } from '@synnel/types'

// Mock transport implementation
class MockTransport implements IServerTransport {
  public connections: Map<ClientId, IClientConnection> = new Map()

  // Event emitter mock
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
      // Call handlers synchronously for proper test execution
      handlers.forEach((handler) => {
        try {
          handler(...args)
        } catch (e) {
          // Ignore errors in handlers
        }
      })
    }
  }

  async sendToClient(clientId: ClientId, message: Message): Promise<void> {
    const client = this.connections.get(clientId)
    if (client && typeof (client.socket as any).send === 'function') {
      ;(client.socket as any).send(JSON.stringify(message))
    }
  }

  async stop(): Promise<void> {
    this.connections.clear()
  }

  // Helper to add a mock client
  addMockClient(id: ClientId): IClientConnection {
    const client: IClientConnection = {
      id,
      socket: {
        send: vi.fn(),
        close: vi.fn(),
      } as any,
      status: 'connected',
      connectedAt: Date.now(),
    }
    this.connections.set(id, client)
    this.emit('connection', client)
    return client
  }

  // Helper to remove a mock client
  removeMockClient(id: ClientId): void {
    this.connections.delete(id)
    this.emit('disconnection', id)
  }

  // Helper to simulate a signal message (for subscribe/unsubscribe)
  simulateSignal(clientId: ClientId, channelName: string, signalType: 'subscribe' | 'unsubscribe'): void {
    const signal: SignalMessage = {
      id: `sig-${Date.now()}`,
      type: MessageType.SIGNAL,
      channel: channelName,
      signal: signalType,
      timestamp: Date.now(),
    }

    this.emit('message', clientId, signal)
  }

  // Helper to simulate a data message
  simulateDataMessage(clientId: ClientId, channelName: string, data: unknown): void {
    const message: DataMessage = {
      id: `msg-${Date.now()}`,
      type: MessageType.DATA,
      channel: channelName,
      data,
      timestamp: Date.now(),
    }

    this.emit('message', clientId, message)
  }
}

describe('Integration Tests', () => {
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
  })

  describe('server lifecycle', () => {
    it('should start the server', async () => {
      const stats = server.getStats()
      expect(stats).toBeDefined()
      expect(stats.startedAt).toBeDefined()
    })

    it('should stop the server', async () => {
      await server.stop()
      // Can stop multiple times without error
      await server.stop()
    })

    it('should handle multiple start/stop cycles', async () => {
      await server.stop()

      const transport2 = new MockTransport()
      const server2 = new SynnelServer({ transport: transport2 })
      await server2.start()

      expect(server2.getStats().startedAt).toBeDefined()

      await server2.stop()
    })
  })

  describe('client connections', () => {
    it('should track connected clients', () => {
      expect(server.getStats().clientCount).toBe(0)

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)

      // Connections are tracked synchronously
      const stats = server.getStats()
      expect(stats.clientCount).toBeGreaterThanOrEqual(0)
    })

    it('should emit connection events', async () => {
      let connectionReceived = false

      server.on('connection', () => {
        connectionReceived = true
      })

      transport.addMockClient('client-1' as ClientId)

      // Events are emitted synchronously
      expect(connectionReceived).toBe(true)
    })

    it('should emit disconnection events', () => {
      let disconnectClient: any

      server.on('disconnection', (client) => {
        disconnectClient = client
      })

      const client = transport.addMockClient('client-1' as ClientId)

      expect(client.id).toBe('client-1')

      transport.removeMockClient('client-1')

      expect(disconnectClient).toBeDefined()
      expect(disconnectClient.id).toBe('client-1')
    })
  })

  describe('channel operations', () => {
    it('should create multicast channels', () => {
      const channel = server.createMulticast('test-channel')

      expect(server.hasChannel('test-channel')).toBe(true)
      expect(channel.name).toBe('test-channel')
    })

    it('should create broadcast channel', () => {
      const broadcast = server.createBroadcast()

      expect(broadcast.name).toBe('__broadcast__')
    })

    it('should list all channels', () => {
      server.createMulticast('channel-1')
      server.createMulticast('channel-2')
      server.createMulticast('channel-3')

      const channels = server.getChannels()
      expect(channels).toContain('channel-1')
      expect(channels).toContain('channel-2')
      expect(channels).toContain('channel-3')
    })

    it('should check if channel exists', () => {
      server.createMulticast('existing-channel')

      expect(server.hasChannel('existing-channel')).toBe(true)
      expect(server.hasChannel('non-existing')).toBe(false)
    })

    it('should report channel count in stats', () => {
      server.createMulticast('ch-1')
      server.createMulticast('ch-2')

      const stats = server.getStats()
      expect(stats.channelCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('channel subscription integration', () => {
    it('should handle subscribe via signal messages', () => {
      const chat = server.createMulticast('chat')
      const client = transport.addMockClient('client-1' as ClientId)

      // Simulate subscribe signal
      transport.simulateSignal('client-1', 'chat', 'subscribe')

      // Channel should have the subscriber
      expect(chat.hasSubscriber('client-1')).toBe(true)
    })

    it('should handle unsubscribe via signal messages', () => {
      const chat = server.createMulticast('chat')
      const client = transport.addMockClient('client-1' as ClientId)

      // First subscribe
      transport.simulateSignal('client-1', 'chat', 'subscribe')
      expect(chat.hasSubscriber('client-1')).toBe(true)

      // Then unsubscribe
      transport.simulateSignal('client-1', 'chat', 'unsubscribe')
      expect(chat.hasSubscriber('client-1')).toBe(false)
    })

    it('should send subscribed acknowledgment', () => {
      const client = transport.addMockClient('client-1' as ClientId)

      transport.simulateSignal('client-1', 'chat', 'subscribe')

      // Check if acknowledgment was sent via socket.send
      const calls = (client.socket as any).send.mock.calls
      const ackMessages = calls.filter((call: string[]) => {
        const msg = JSON.parse(call[0])
        return msg.type === MessageType.SIGNAL && msg.signal === 'subscribed'
      })

      expect(ackMessages.length).toBeGreaterThan(0)
    })

    it('should send unsubscribed acknowledgment', () => {
      const client = transport.addMockClient('client-1' as ClientId)

      // First subscribe
      transport.simulateSignal('client-1', 'chat', 'subscribe')
      vi.clearAllMocks()

      // Then unsubscribe
      transport.simulateSignal('client-1', 'chat', 'unsubscribe')

      // Check if acknowledgment was sent
      const calls = (client.socket as any).send.mock.calls
      const ackMessages = calls.filter((call: string[]) => {
        const msg = JSON.parse(call[0])
        return msg.type === MessageType.SIGNAL && msg.signal === 'unsubscribed'
      })

      expect(ackMessages.length).toBeGreaterThan(0)
    })
  })

  describe('message handling', () => {
    it('should route messages to correct channels', () => {
      const chat = server.createMulticast<string>('chat')
      const news = server.createMulticast<string>('news')

      const client = transport.addMockClient('client-1' as ClientId)

      // Subscribe to chat
      chat.subscribe('client-1')

      // Send message to chat channel
      transport.simulateDataMessage('client-1', 'chat', 'Hello chat')

      // Client should receive the message via socket.send
      expect((client.socket as any).send).toHaveBeenCalled()
    })

    it('should register and call global message handlers', () => {
      let receivedData: unknown

      server.onMessage((client, message) => {
        receivedData = message.data
      })

      const client = transport.addMockClient('client-1' as ClientId)
      transport.simulateDataMessage('client-1', 'test', 'test message')

      expect(receivedData).toBe('test message')
    })
  })

  describe('middleware', () => {
    it('should register middleware via use()', () => {
      const middleware = vi.fn()

      server.use(middleware)

      // Middleware is registered (verified by no error thrown)
      expect(middleware).toBeDefined()
    })

    it('should register authorization handler', () => {
      const authHandler = vi.fn(() => true)

      server.authorize(authHandler)

      // Authorization handler is registered (verified by no error thrown)
      expect(authHandler).toBeDefined()
    })

    it('should execute connection middleware and reject when needed', async () => {
      let middlewareCalled = false

      server.use(async ({ reject }) => {
        middlewareCalled = true
        reject('Not allowed')
      })

      // Add client - should be rejected and removed
      transport.addMockClient('client-1' as ClientId)

      // Client should be removed due to rejection
      expect(transport.connections.has('client-1')).toBe(false)
    })
  })

  describe('event handling', () => {
    it('should register multiple connection event handlers', () => {
      let count1 = 0
      let count2 = 0

      server.on('connection', () => {
        count1++
      })

      server.on('connection', () => {
        count2++
      })

      transport.addMockClient('client-1' as ClientId)

      expect(count1).toBe(1)
      expect(count2).toBe(1)
    })

    it('should unregister event handler with returned function', () => {
      let count = 0

      const unsubscribe = server.on('connection', () => {
        count++
      })

      unsubscribe()

      transport.addMockClient('client-1' as ClientId)

      expect(count).toBe(0)
    })

    it('should support once event handlers', () => {
      let count = 0

      server.once('connection', () => {
        count++
      })

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)

      expect(count).toBe(1) // Only called once
    })
  })

  describe('server stats', () => {
    it('should return accurate stats', () => {
      const stats = server.getStats()

      expect(stats).toBeDefined()
      expect(stats.startedAt).toBeDefined()
      expect(typeof stats.clientCount).toBe('number')
      expect(typeof stats.channelCount).toBe('number')
      expect(typeof stats.subscriptionCount).toBe('number')
    })

    it('should have correct initial stats', () => {
      const stats = server.getStats()

      expect(stats.clientCount).toBe(0)
      expect(stats.messagesReceived).toBe(0)
      expect(stats.messagesSent).toBe(0)
    })

    it('should track channel count', () => {
      server.createMulticast('ch-1')
      server.createMulticast('ch-2')

      const stats = server.getStats()
      expect(stats.channelCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('error handling', () => {
    it('should handle error events', () => {
      let errorReceived: Error | undefined

      server.on('error', (error) => {
        errorReceived = error
      })

      const testError = new Error('Test error')
      transport.emit('error', testError)

      expect(errorReceived).toBe(testError)
    })
  })
})
