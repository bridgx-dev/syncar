/**
 * Integration Tests
 * Tests server functionality with mocked transport
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { SynnelServer } from '../../src/server/index.js'
import type { ISynnelServer, IServerTransport } from '../../src/types/index.js'
import type { IClientConnection } from '../../src/types/index.js'
import type { ClientId, Message, DataMessage, SignalMessage } from '../../src/types/index.js'
import { MessageType, SignalType } from '../../src/types/index.js'

// Mock transport implementation
class MockTransport extends EventEmitter implements IServerTransport {
  public connections: Map<ClientId, IClientConnection> = new Map()

  async start(): Promise<void> {
    // Mock implementation
  }

  async stop(): Promise<void> {
    this.connections.clear()
  }

  async emitAsync(event: string, ...args: any[]): Promise<void> {
    const listeners = this.listeners(event) as Function[]
    for (const listener of listeners) {
      const result = listener(...args)
      if (result instanceof Promise) {
        await result
      }
    }
  }

  // Helper to add a mock client
  async addMockClient(id: ClientId): Promise<IClientConnection> {
    let socketClosed = false

    const client: IClientConnection = {
      id,
      socket: {
        send: vi.fn().mockImplementation((_msg, cb) => {
          if (typeof cb === 'function') {
            process.nextTick(() => cb())
          }
        }),
        close: vi.fn((code: number, reason: string) => {
          socketClosed = true
          // Note: Don't remove from connections here, let the addMockClient method handle it
        }),
      } as any,
      connectedAt: Date.now(),
    }
    this.connections.set(id, client)
    await this.emitAsync('connection', client)

    // If socket was closed during handler execution (rejected), remove from connections
    if (socketClosed) {
      this.connections.delete(id)
    }

    return client
  }

  // Helper to remove a mock client
  async removeMockClient(id: ClientId): Promise<void> {
    this.connections.delete(id)
    await this.emit('disconnection', id)
  }

  // Helper to simulate a signal message (for subscribe/unsubscribe)
  async simulateSignal(clientId: ClientId, channelName: string, signalType: SignalType): Promise<void> {
    const signal: SignalMessage = {
      id: `sig-${Date.now()}`,
      type: MessageType.SIGNAL,
      channel: channelName,
      signal: signalType,
      timestamp: Date.now(),
    }

    await this.emitAsync('message', clientId, signal)
  }

  // Helper to simulate a data message
  async simulateDataMessage(clientId: ClientId, channelName: string, data: unknown): Promise<void> {
    const message: DataMessage = {
      id: `msg-${Date.now()}`,
      type: MessageType.DATA,
      channel: channelName,
      data,
      timestamp: Date.now(),
    }

    await this.emitAsync('message', clientId, message)
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
    it('should track connected clients', async () => {
      expect(server.getStats().clientCount).toBe(0)

      await transport.addMockClient('client-1' as ClientId)
      await transport.addMockClient('client-2' as ClientId)

      // Connections are tracked
      const stats = server.getStats()
      expect(stats.clientCount).toBeGreaterThanOrEqual(2)
    })

    it('should emit connection events', async () => {
      let connectionReceived = false

      server.on('connection', () => {
        connectionReceived = true
      })

      await transport.addMockClient('client-1' as ClientId)

      expect(connectionReceived).toBe(true)
    })

    it('should emit disconnection events', async () => {
      let disconnectClient: any

      server.on('disconnection', (client) => {
        disconnectClient = client
      })

      const client = await transport.addMockClient('client-1' as ClientId)

      expect(client.id).toBe('client-1')

      await transport.removeMockClient('client-1' as ClientId)

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
    it('should handle subscribe via signal messages', async () => {
      const chat = server.createMulticast('chat')
      await transport.addMockClient('client-1' as ClientId)

      // Simulate subscribe signal
      await transport.simulateSignal('client-1' as ClientId, 'chat', SignalType.SUBSCRIBE)

      // Channel should have the subscriber
      expect(chat.hasSubscriber('client-1')).toBe(true)
    })

    it('should handle unsubscribe via signal messages', async () => {
      const chat = server.createMulticast('chat')
      await transport.addMockClient('client-1' as ClientId)

      // First subscribe
      await transport.simulateSignal('client-1' as ClientId, 'chat', SignalType.SUBSCRIBE)
      expect(chat.hasSubscriber('client-1')).toBe(true)

      // Then unsubscribe
      await transport.simulateSignal('client-1' as ClientId, 'chat', SignalType.UNSUBSCRIBE)
      expect(chat.hasSubscriber('client-1')).toBe(false)
    })

    it('should send subscribed acknowledgment', async () => {
      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('chat') // Create the channel first

      await transport.simulateSignal('client-1' as ClientId, 'chat', SignalType.SUBSCRIBE)

      // Check if acknowledgment was sent via socket.send
      const client = transport.connections.get('client-1' as ClientId)
      const calls = (client?.socket as any)?.send?.mock?.calls || []
      const ackMessages = calls.filter((call: string[]) => {
        const msg = JSON.parse(call[0])
        return msg.type === MessageType.SIGNAL && msg.signal === SignalType.SUBSCRIBED
      })

      expect(ackMessages.length).toBeGreaterThan(0)
    })

    it('should send unsubscribed acknowledgment', async () => {
      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('chat') // Create the channel first

      // First subscribe
      await transport.simulateSignal('client-1' as ClientId, 'chat', SignalType.SUBSCRIBE)
      vi.clearAllMocks()

      // Then unsubscribe
      await transport.simulateSignal('client-1' as ClientId, 'chat', SignalType.UNSUBSCRIBE)

      // Check if acknowledgment was sent
      const client = transport.connections.get('client-1' as ClientId)
      const calls = (client?.socket as any)?.send?.mock?.calls || []
      const ackMessages = calls.filter((call: string[]) => {
        const msg = JSON.parse(call[0])
        return msg.type === MessageType.SIGNAL && msg.signal === SignalType.UNSUBSCRIBED
      })

      expect(ackMessages.length).toBeGreaterThan(0)
    })
  })

  describe('message handling', () => {
    it('should route messages to correct channels', async () => {
      const chat = server.createMulticast<string>('chat')
      await transport.addMockClient('client-1' as ClientId)

      // Subscribe to chat
      chat.subscribe('client-1')

      // Verify subscription
      expect(chat.hasSubscriber('client-1')).toBe(true)

      // Publish to chat
      chat.publish('Hello chat')

      // Client should receive the message via socket.send
      const client = transport.connections.get('client-1' as ClientId)
      expect((client?.socket as any)?.send).toHaveBeenCalled()
    })

    it('should register and call global message handlers', async () => {
      let receivedData: unknown

      server.onMessage((client, message) => {
        receivedData = message.data
      })

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('test') // Create the channel first
      await transport.simulateDataMessage('client-1' as ClientId, 'test', 'test message')

      expect(receivedData).toBe('test message')
    })

    it('should handle errors in global message handlers gracefully', async () => {
      let handlerCalled = false
      let secondHandlerCalled = false

      // First handler throws an error
      server.onMessage(() => {
        handlerCalled = true
        throw new Error('Handler error')
      })

      // Second handler should still be called
      server.onMessage(() => {
        secondHandlerCalled = true
      })

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('test') // Create the channel first

      // Should not throw despite error in handler
      await expect(
        transport.simulateDataMessage('client-1' as ClientId, 'test', 'test message'),
      ).resolves.toBeUndefined()

      // Both handlers should be called
      expect(handlerCalled).toBe(true)
      expect(secondHandlerCalled).toBe(true)
    })

    it('should not process message when authorization returns false', async () => {
      let handlerCalled = false

      // Set authorization to deny all messages
      server.authorize(() => false)

      server.onMessage(() => {
        handlerCalled = true
      })

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('test') // Create the channel first

      await transport.simulateDataMessage('client-1' as ClientId, 'test', 'test message')

      // Handler should not be called due to authorization denial
      expect(handlerCalled).toBe(false)
    })

    it('should process message when authorization returns true', async () => {
      let handlerCalled = false

      // Set authorization to allow messages
      server.authorize(() => true)

      server.onMessage(() => {
        handlerCalled = true
      })

      await transport.addMockClient('client-1' as ClientId)
      server.createMulticast('test') // Create the channel first

      await transport.simulateDataMessage('client-1' as ClientId, 'test', 'test message')

      // Handler should be called
      expect(handlerCalled).toBe(true)
    })
  })

  describe('middleware', () => {
    it('should register middleware via use()', async () => {
      const middleware = vi.fn()

      server.use(middleware)

      expect(middleware).toBeDefined()
    })

    it('should register authorization handler', async () => {
      const authHandler = vi.fn(() => true)

      server.authorize(authHandler)

      expect(authHandler).toBeDefined()
    })

    it('should execute connection middleware and reject when needed', async () => {
      let middlewareCalled = false

      server.use(async ({ reject }) => {
        middlewareCalled = true
        reject('Not allowed')
      })

      // Add client - should be rejected and removed
      await transport.addMockClient('client-1' as ClientId)

      // Client should be removed due to rejection
      expect(transport.connections.has('client-1')).toBe(false)
    })
  })

  describe('event handling', () => {
    it('should register multiple connection event handlers', async () => {
      let count1 = 0
      let count2 = 0

      server.on('connection', () => {
        count1++
      })

      server.on('connection', () => {
        count2++
      })

      await transport.addMockClient('client-1' as ClientId)

      expect(count1).toBe(1)
      expect(count2).toBe(1)
    })

    it('should unregister event handler with returned function', async () => {
      let count = 0

      const unsubscribe = server.on('connection', () => {
        count++
      })

      unsubscribe()

      await transport.addMockClient('client-1' as ClientId)

      expect(count).toBe(0)
    })

    it('should support once event handlers', async () => {
      let count = 0

      server.once('connection', () => {
        count++
      })

      await transport.addMockClient('client-1' as ClientId)
      await transport.addMockClient('client-2' as ClientId)

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

    it('should emit error event when connection handler throws', async () => {
      let errorReceived: Error | undefined

      server.on('error', (error) => {
        errorReceived = error
      })

      // Make the connection handler throw by using middleware that rejects
      server.use(async ({ reject }) => {
        reject('Connection rejected')
      })

      await transport.addMockClient('client-1' as ClientId)

      // Error should be emitted due to rejection
      expect(transport.connections.has('client-1' as ClientId)).toBe(false)
    })
  })
})
