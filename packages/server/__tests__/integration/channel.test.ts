/**
 * Channel Integration Tests
 * Tests channel subscription, messaging, and broadcasting scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { SynnelServer } from '../../src/server/index.js'
import { ChannelRef, BroadcastChannel } from '../../src/channel/index.js'
import type {
  ISynnelServer,
  IServerTransport,
  IClientConnection,
} from '../../src/types/index.js'
import type { ClientId, Message, SignalMessage } from '../../src/types/index.js'
import { MessageType, SignalType, DataMessage } from '../../src/types/index.js'

// Mock transport implementation
class MockTransport extends EventEmitter implements IServerTransport {
  public connections: Map<ClientId, IClientConnection> = new Map()

  private messageQueue: Array<{ clientId: ClientId; message: any }> = []

  constructor() {
    super()
  }

  // Helper to match IEventEmitter interface which on() now must return 'this' or similar
  // Node's version returns 'this' which is fine

  async sendToClient(clientId: ClientId, message: Message): Promise<void> {
    this.messageQueue.push({ clientId, message })
    const client = this.connections.get(clientId)
    if (client && typeof (client.socket as any).send === 'function') {
      ;(client.socket as any).send(JSON.stringify(message))
    }
  }

  async stop(): Promise<void> {
    this.connections.clear()
  }

  getMessages(
    clientId?: ClientId,
  ): Array<{ clientId: ClientId; message: Message }> {
    if (clientId) {
      return this.messageQueue.filter((m) => m.clientId === clientId)
    }
    return this.messageQueue
  }

  clearMessages(): void {
    this.messageQueue = []
  }

  addMockClient(id: ClientId): IClientConnection {
    const client: IClientConnection = {
      id,
      socket: {
        send: vi.fn(),
        close: vi.fn(),
      } as any,
      connectedAt: Date.now(),
    }
    this.connections.set(id, client)
    this.emit('connection', client)
    return client
  }

  removeMockClient(id: ClientId): void {
    this.connections.delete(id)
    this.emit('disconnection', id)
  }
}

describe('Channel Integration Tests', () => {
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

  describe('broadcast channel', () => {
    it('should send messages to all connected clients', () => {
      const broadcast = server.createBroadcast<string>()

      // Add multiple clients
      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)
      const client3 = transport.addMockClient('client-3' as ClientId)

      // Publish to broadcast
      broadcast.publish('Hello all!')

      // All clients should receive the message via socket.send()
      expect((client1.socket as any).send).toHaveBeenCalled()
      expect((client2.socket as any).send).toHaveBeenCalled()
      expect((client3.socket as any).send).toHaveBeenCalled()
    })

    it('should exclude specified clients from broadcast', () => {
      const broadcast = server.createBroadcast<string>()

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)
      transport.addMockClient('client-3' as ClientId)

      // Publish excluding client-2
      broadcast.publish('Message', { exclude: ['client-2'] })

      // client-1 and client-3 should receive, client-2 should not
      expect(
        (transport.connections.get('client-1')?.socket as any).send,
      ).toHaveBeenCalled()
      expect(
        (transport.connections.get('client-2')?.socket as any).send,
      ).not.toHaveBeenCalled()
      expect(
        (transport.connections.get('client-3')?.socket as any).send,
      ).toHaveBeenCalled()
    })

    it('should send to only specified clients', () => {
      const broadcast = server.createBroadcast<string>()

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)
      transport.addMockClient('client-3' as ClientId)

      // Publish to specific clients only
      broadcast.publish('Private message', { to: ['client-1', 'client-3'] })

      // client-1 and client-3 should receive
      expect(
        (transport.connections.get('client-1')?.socket as any).send,
      ).toHaveBeenCalled()
      expect(
        (transport.connections.get('client-2')?.socket as any).send,
      ).not.toHaveBeenCalled()
      expect(
        (transport.connections.get('client-3')?.socket as any).send,
      ).toHaveBeenCalled()
    })
  })

  describe('multicast channel subscription', () => {
    it('should only send to subscribed clients', () => {
      const channel = server.createMulticast<string>('chat')

      // Add clients but only subscribe some
      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)
      transport.addMockClient('client-3' as ClientId)

      // Subscribe only client-1 and client-3
      channel.subscribe('client-1')
      channel.subscribe('client-3')

      // Publish message
      channel.publish('Chat message')

      // client-1 and client-3 should receive
      expect(
        (transport.connections.get('client-1')?.socket as any).send,
      ).toHaveBeenCalled()
      expect(
        (transport.connections.get('client-2')?.socket as any).send,
      ).not.toHaveBeenCalled()
      expect(
        (transport.connections.get('client-3')?.socket as any).send,
      ).toHaveBeenCalled()
    })

    it('should handle subscribe and unsubscribe', () => {
      const channel = server.createMulticast<string>('chat')

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)

      channel.subscribe('client-1')
      channel.subscribe('client-2')

      // First message - both receive
      channel.publish('Message 1')
      expect(
        (transport.connections.get('client-1')?.socket as any).send,
      ).toHaveBeenCalled()
      expect(
        (transport.connections.get('client-2')?.socket as any).send,
      ).toHaveBeenCalled()

      // Reset mocks
      vi.clearAllMocks()

      // Unsubscribe client-1
      channel.unsubscribe('client-1')

      // Second message - only client-2 receives
      channel.publish('Message 2')
      expect(
        (transport.connections.get('client-1')?.socket as any).send,
      ).not.toHaveBeenCalled()
      expect(
        (transport.connections.get('client-2')?.socket as any).send,
      ).toHaveBeenCalled()
    })

    it('should handle client disconnection', () => {
      const channel = server.createMulticast<string>('chat')

      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)

      channel.subscribe('client-1')
      channel.subscribe('client-2')

      // Remove client-1
      transport.removeMockClient('client-1')

      vi.clearAllMocks()

      // Publish message - only client-2 should receive
      channel.publish('After disconnect')
      expect(
        (transport.connections.get('client-2')?.socket as any).send,
      ).toHaveBeenCalled()
    })
  })

  describe('multiple channels', () => {
    it('should allow clients in different channels', () => {
      const chat = server.createMulticast<string>('chat')
      const news = server.createMulticast<string>('news')

      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)

      // Subscribe to different channels
      chat.subscribe('client-1')
      news.subscribe('client-2')

      // Publish to chat
      chat.publish('Chat message')
      expect((client1.socket as any).send).toHaveBeenCalled()
      expect((client2.socket as any).send).not.toHaveBeenCalled()

      vi.clearAllMocks()

      // Publish to news
      news.publish('News update')
      expect((client1.socket as any).send).not.toHaveBeenCalled()
      expect((client2.socket as any).send).toHaveBeenCalled()
    })

    it('should allow clients in multiple channels', () => {
      const chat = server.createMulticast<string>('chat')
      const news = server.createMulticast<string>('news')

      const client = transport.addMockClient('client-1' as ClientId)

      // Subscribe to both channels
      chat.subscribe('client-1')
      news.subscribe('client-1')

      // Publish to chat
      chat.publish('Chat message')
      expect((client.socket as any).send).toHaveBeenCalled()

      vi.clearAllMocks()

      // Publish to news
      news.publish('News update')
      expect((client.socket as any).send).toHaveBeenCalled()
    })

    it('should track subscriptions correctly', () => {
      const chat = server.createMulticast<string>('chat')
      const news = server.createMulticast<string>('news')

      transport.addMockClient('client-1' as ClientId)
      transport.addMockClient('client-2' as ClientId)

      chat.subscribe('client-1')
      chat.subscribe('client-2')
      news.subscribe('client-1')

      expect(chat.subscriberCount).toBe(2)
      expect(news.subscriberCount).toBe(1)

      // Check via server stats - includes broadcast channel
      const stats = server.getStats()
      expect(stats.subscriptionCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('channel events', () => {
    it('should trigger channel subscribe handlers', async () => {
      let subscribeCalled = false
      let receivedClient: any

      const channel = server.createMulticast<string>('chat')

      channel.onSubscribe((client) => {
        subscribeCalled = true
        receivedClient = client
      })

      const client = transport.addMockClient('client-1' as ClientId)

      // Use handleSubscribe to trigger handlers (this is what SignalHandler does)
      await channel.handleSubscribe(client)

      expect(subscribeCalled).toBe(true)
      expect(receivedClient).toBeDefined()
    })

    it('should trigger channel unsubscribe handlers', async () => {
      let unsubscribeCalled = false
      let receivedClient: any

      const channel = server.createMulticast<string>('chat')

      channel.onUnsubscribe((client) => {
        unsubscribeCalled = true
        receivedClient = client
      })

      const client = transport.addMockClient('client-1' as ClientId)

      // Use handleUnsubscribe to trigger handlers
      await channel.handleUnsubscribe(client)

      expect(unsubscribeCalled).toBe(true)
      expect(receivedClient).toBeDefined()
    })

    it('should trigger channel message handlers', async () => {
      let receivedData: string | undefined

      const channel = server.createMulticast<string>('chat')

      channel.onMessage((data, _client, _message) => {
        receivedData = data
      })

      const client = transport.addMockClient('client-1' as ClientId)

      // Create a mock data message
      const dataMessage: DataMessage<string> = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'chat',
        data: 'Test message',
        timestamp: Date.now(),
      }

      // Use receive to trigger message handlers (this is what MessageHandler does)
      await channel.receive('Test message', client, dataMessage)

      expect(receivedData).toBe('Test message')
    })
  })

  describe('publish options', () => {
    it('should support publish with exclude option', () => {
      const channel = server.createMulticast<string>('chat')

      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)
      const client3 = transport.addMockClient('client-3' as ClientId)

      // Subscribe all
      channel.subscribe('client-1')
      channel.subscribe('client-2')
      channel.subscribe('client-3')

      // Publish excluding client-2
      channel.publish('Message', { exclude: ['client-2'] })

      // client-1 and client-3 should receive
      expect((client1.socket as any).send).toHaveBeenCalled()
      expect((client2.socket as any).send).not.toHaveBeenCalled()
      expect((client3.socket as any).send).toHaveBeenCalled()
    })

    it('should support publish with to option', () => {
      const channel = server.createMulticast<string>('chat')

      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)
      const client3 = transport.addMockClient('client-3' as ClientId)

      // Subscribe all
      channel.subscribe('client-1')
      channel.subscribe('client-2')
      channel.subscribe('client-3')

      // Publish to specific clients only
      channel.publish('Private', { to: ['client-1', 'client-3'] })

      // client-1 and client-3 should receive
      expect((client1.socket as any).send).toHaveBeenCalled()
      expect((client2.socket as any).send).not.toHaveBeenCalled()
      expect((client3.socket as any).send).toHaveBeenCalled()
    })

    it('should support publish with both to and exclude', () => {
      const channel = server.createMulticast<string>('chat')

      const client1 = transport.addMockClient('client-1' as ClientId)
      const client2 = transport.addMockClient('client-2' as ClientId)
      const client3 = transport.addMockClient('client-3' as ClientId)

      channel.subscribe('client-1')
      channel.subscribe('client-2')
      channel.subscribe('client-3')

      // Publish to client-1 and client-2, but exclude client-1
      channel.publish('Complex', {
        to: ['client-1', 'client-2'],
        exclude: ['client-1'],
      })

      // Only client-2 should receive
      expect((client1.socket as any).send).not.toHaveBeenCalled()
      expect((client2.socket as any).send).toHaveBeenCalled()
      expect((client3.socket as any).send).not.toHaveBeenCalled()
    })
  })
})
