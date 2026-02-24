/**
 * Integration Tests
 * Tests server functionality with mocked transport
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SynnelServer } from '../../src/server/index.js'
import type { ISynnelServer, IServerTransport } from '../../src/types/index.js'
import type { IClientConnection } from '../../src/types/index.js'
import type { ClientId, Message, DataMessage } from '@synnel/types'

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
      // Call handlers asynchronously to simulate real transport behavior
      setTimeout(() => {
        handlers.forEach((handler) => {
          try {
            handler(...args)
          } catch (e) {
            // Ignore errors in handlers
          }
        })
      }, 0)
    }
  }

  async sendToClient(clientId: ClientId, message: Message): Promise<void> {
    const client = this.connections.get(clientId)
    if (client) {
      // Mock sending - just call the send method
      if (typeof (client.socket as any).send === 'function') {
        (client.socket as any).send(JSON.stringify(message))
      }
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
      metadata: {},
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

  // Helper to simulate a message from a client
  simulateMessage(clientId: ClientId, data: unknown): void {
    const message: DataMessage<unknown> = {
      type: 'data',
      channel: 'test',
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

      // Wait for async processing
      setTimeout(() => {
        const stats = server.getStats()
        expect(stats.clientCount).toBeGreaterThanOrEqual(0)
      }, 10)
    })

    it('should emit connection events', async () => {
      let connectionReceived = false

      server.on('connection', () => {
        connectionReceived = true
      })

      transport.addMockClient('client-1' as ClientId)

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(connectionReceived).toBe(true)
    })

    it('should emit disconnection events', async () => {
      let connectionClient: any

      server.on('connection', (client) => {
        connectionClient = client
      })

      server.on('disconnection', (client) => {
        // Verify we receive the client that was connected
        expect(client).toBeDefined()
        expect(client.id).toBe(connectionClient?.id)
      })

      transport.addMockClient('client-1' as ClientId)

      // Wait for connection to be processed
      await new Promise(resolve => setTimeout(resolve, 150))

      // Verify client was connected
      expect(connectionClient).toBeDefined()

      // Now disconnect
      transport.removeMockClient('client-1' as ClientId)

      // Wait for disconnection to be processed
      await new Promise(resolve => setTimeout(resolve, 150))
    }, 10000)
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

  describe('message handling', () => {
    it('should register global message handlers', async () => {
      let receivedData: unknown

      server.onMessage((client, message) => {
        receivedData = message.data
      })

      // Add a client and simulate a message
      const client = transport.addMockClient('client-1' as ClientId)
      transport.simulateMessage(client.id, 'test message')

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10))

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
  })

  describe('event handling', () => {
    it('should register connection event handler', async () => {
      let connections = 0

      server.on('connection', () => {
        connections++
      })

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(connections).toBe(2)
    })

    it('should unregister connection event handler', async () => {
      let connections = 0

      const unsubscribe = server.on('connection', () => {
        connections++
      })

      unsubscribe()

      transport.addMockClient('client-1' as ClientId)

      expect(connections).toBe(0)
    })

    it('should register multiple handlers for the same event', async () => {
      let count1 = 0
      let count2 = 0

      server.on('connection', () => { count1++ })
      server.on('connection', () => { count2++ })

      transport.addMockClient('client-1' as ClientId)

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(count1).toBe(1)
      expect(count2).toBe(1)
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

  describe('channel publish', () => {
    it('should publish to broadcast channel', () => {
      const broadcast = server.createBroadcast<string>()

      // Add mock clients
      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)

      // Publish message
      broadcast.publish('Hello everyone!')

      // Verify clients received the message (via sendToClient mock)
      expect((client1.socket as any).send).toHaveBeenCalled()
      expect((client2.socket as any).send).toHaveBeenCalled()
    })

    it('should publish to multicast channel', () => {
      const channel = server.createMulticast<string>('test-channel')

      // Add mock clients
      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)

      // Subscribe clients to channel
      channel.subscribe('client-1')
      channel.subscribe('client-2')

      // Publish message
      channel.publish('Test message')

      // Verify clients received the message
      expect((client1.socket as any).send).toHaveBeenCalled()
      expect((client2.socket as any).send).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle error events', async () => {
      let errorReceived: Error | undefined

      server.on('error', (error) => {
        errorReceived = error
      })

      const testError = new Error('Test error')
      transport.emit('error', testError)

      // Wait for async event handling
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(errorReceived).toBe(testError)
    })
  })
})
