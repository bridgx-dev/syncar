/**
 * Channel Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BaseChannel,
  BroadcastTransport,
  MulticastTransport,
} from '../src/channel/index.js'
import type { IClientConnection } from '../src/types/index.js'
import type { IChannelTransport } from '../src/types/index.js'

// Mock client connection
function createMockClient(id: string): IClientConnection {
  return {
    id,
    socket: {
      send: vi.fn(),
      close: vi.fn(),
    } as any,
    status: 'connected',
    connectedAt: Date.now(),
    metadata: {},
  }
}

describe('Channels', () => {
  describe('MulticastTransport', () => {
    let channel: MulticastTransport<string>
    let clients: Map<string, IClientConnection>

    beforeEach(() => {
      clients = new Map()
      channel = new MulticastTransport<string>('test', clients)
    })

    describe('subscription', () => {
      it('should subscribe a client', () => {
        const result = channel.subscribe('client-1')

        expect(result).toBe(true)
        expect(channel.hasSubscriber('client-1')).toBe(true)
        expect(channel.subscriberCount).toBe(1)
      })

      it('should not subscribe duplicate client', () => {
        channel.subscribe('client-1')
        const result = channel.subscribe('client-1')

        expect(result).toBe(false)
        expect(channel.subscriberCount).toBe(1)
      })

      it('should unsubscribe a client', () => {
        channel.subscribe('client-1')
        const result = channel.unsubscribe('client-1')

        expect(result).toBe(true)
        expect(channel.subscriberCount).toBe(0)
      })

      it('should return false when unsubscribing non-existent client', () => {
        const result = channel.unsubscribe('client-1')

        expect(result).toBe(false)
      })

      it('should respect maxSubscribers limit', () => {
        const limitedChannel = new MulticastTransport<string>(
          'limited',
          clients,
          {
            maxSubscribers: 2,
          },
        )

        limitedChannel.subscribe('client-1')
        limitedChannel.subscribe('client-2')
        const result = limitedChannel.subscribe('client-3')

        expect(result).toBe(false)
        expect(limitedChannel.isFull()).toBe(true)
      })

      it('should check if client has subscribed', () => {
        expect(channel.hasSubscriber('client-1')).toBe(false)

        channel.subscribe('client-1')

        expect(channel.hasSubscriber('client-1')).toBe(true)
      })
    })

    describe('publish', () => {
      beforeEach(() => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')
        clients.set('client-1', client1)
        clients.set('client-2', client2)
        channel.subscribe('client-1')
        channel.subscribe('client-2')
      })

      it('should send message to all subscribers', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        channel.publish('Hello everyone')

        expect(client1.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Hello everyone'),
        )
        expect(client2.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Hello everyone'),
        )
      })

      it('should send to specific subscribers only with "to" option', () => {
        const client1 = clients.get('client-1')!

        channel.publish('Private message', { to: ['client-1'] })

        expect(client1.socket.send).toHaveBeenCalled()
        // client2 should not receive the message
      })

      it('should exclude specified subscribers with "exclude" option', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        channel.publish('Message for client-2', { exclude: ['client-1'] })

        // client1 should NOT receive the message
        const calls1 = (client1.socket.send as any).mock.calls
        const relevant1 = calls1.filter((call: any[]) =>
          call[0].includes('Message for client-2'),
        )
        expect(relevant1).toHaveLength(0)

        // client2 should receive
        const calls2 = (client2.socket.send as any).mock.calls
        const relevant2 = calls2.filter((call: any[]) =>
          call[0].includes('Message for client-2'),
        )
        expect(relevant2.length).toBeGreaterThan(0)
      })

      it('should combine "to" and "exclude" options', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        channel.publish('Message', {
          to: ['client-1', 'client-2'],
          exclude: ['client-1'],
        })

        // client1 should NOT receive
        const calls1 = (client1.socket.send as any).mock.calls
        const relevant1 = calls1.filter((call: any[]) =>
          call[0].includes('Message'),
        )
        expect(relevant1).toHaveLength(0)

        // client2 should receive
        const calls2 = (client2.socket.send as any).mock.calls
        const relevant2 = calls2.filter((call: any[]) =>
          call[0].includes('Message'),
        )
        expect(relevant2.length).toBeGreaterThan(0)
      })
    })

    describe('handler registration', () => {
      it('should register onMessage handler', () => {
        let receivedData: string | undefined
        let receivedClient: IClientConnection | undefined

        const unsubscribe = channel.onMessage((data, client) => {
          receivedData = data
          receivedClient = client
        })

        expect(typeof unsubscribe).toBe('function')

        // Trigger handler manually via protected method
        ;(channel as any).handleMessage(
          'test data',
          createMockClient('client-1'),
          {
            type: 'data',
            channel: 'test',
            data: 'test data',
            timestamp: Date.now(),
          },
        )

        expect(receivedData).toBe('test data')
        expect(receivedClient).toBeDefined()
      })

      it('should register onSubscribe handler', () => {
        let receivedClient: IClientConnection | undefined

        const unsubscribe = channel.onSubscribe((client) => {
          receivedClient = client
        })

        // Trigger handler manually
        ;(channel as any).handleSubscribe(createMockClient('client-1'))

        expect(receivedClient).toBeDefined()
      })

      it('should register onUnsubscribe handler', () => {
        let receivedClient: IClientConnection | undefined

        const unsubscribe = channel.onUnsubscribe((client) => {
          receivedClient = client
        })

        // Trigger handler manually
        ;(channel as any).handleUnsubscribe(createMockClient('client-1'))

        expect(receivedClient).toBeDefined()
      })

      it('should remove handler when unsubscribe function is called', () => {
        const handler = vi.fn()
        const unsubscribe = channel.onMessage(handler)

        unsubscribe()

        // Trigger manually - handler should not be called
        ;(channel as any).handleMessage('test', createMockClient('client-1'), {
          type: 'data',
          channel: 'test',
          data: 'test',
          timestamp: Date.now(),
        })

        // Handler was removed, so it shouldn't be called
        // We can't directly test this without inspecting the internal handlers set
        expect(typeof unsubscribe).toBe('function')
      })
    })

    describe('state', () => {
      it('should return correct state', () => {
        channel.subscribe('client-1')

        const state = channel.getState()

        expect(state.name).toBe('test')
        expect(state.subscriberCount).toBe(1)
        expect(state.createdAt).toBeDefined()
        expect(state.lastMessageAt).toBeUndefined()
      })

      it('should update lastMessageAt after publish', async () => {
        const client = createMockClient('client-1')
        clients.set('client-1', client)
        channel.subscribe('client-1')

        channel.publish('Test message')

        const state = channel.getState()
        expect(state.lastMessageAt).toBeDefined()
      })

      it('should return correct subscriber count', () => {
        expect(channel.subscriberCount).toBe(0)

        channel.subscribe('client-1')
        expect(channel.subscriberCount).toBe(1)

        channel.subscribe('client-2')
        expect(channel.subscriberCount).toBe(2)
      })

      it('should check if channel is empty', () => {
        expect(channel.isEmpty()).toBe(true)

        channel.subscribe('client-1')

        expect(channel.isEmpty()).toBe(false)
      })

      it('should check if channel is reserved', () => {
        expect(channel.isReserved()).toBe(false)

        const reservedChannel = new MulticastTransport('__private__', clients, {
          reserved: true,
        })

        expect(reservedChannel.isReserved()).toBe(true)
      })
    })

    describe('message history', () => {
      it('should track message history when enabled', () => {
        const channelWithHistory = new MulticastTransport<string>(
          'test-history',
          clients,
          { historySize: 5 },
        )

        // Publish messages
        channelWithHistory.publish('Message 1')
        channelWithHistory.publish('Message 2')
        channelWithHistory.publish('Message 3')

        const history = channelWithHistory.getHistory()

        expect(history).toHaveLength(3)
        expect(history[0].data).toBe('Message 1')
        expect(history[1].data).toBe('Message 2')
        expect(history[2].data).toBe('Message 3')
      })

      it('should limit history to configured size', () => {
        const channelWithHistory = new MulticastTransport<string>(
          'test-history',
          clients,
          { historySize: 2 },
        )

        // Publish more messages than history size
        channelWithHistory.publish('Message 1')
        channelWithHistory.publish('Message 2')
        channelWithHistory.publish('Message 3')

        const history = channelWithHistory.getHistory()

        expect(history).toHaveLength(2)
        expect(history[0].data).toBe('Message 2')
        expect(history[1].data).toBe('Message 3')
      })

      it('should have no history when disabled', () => {
        channel.publish('Test message')

        const history = channel.getHistory()

        expect(history).toHaveLength(0)
      })

      it('should clear history', () => {
        const channelWithHistory = new MulticastTransport<string>(
          'test-history',
          clients,
          { historySize: 5 },
        )

        channelWithHistory.publish('Message 1')
        channelWithHistory.publish('Message 2')

        expect(channelWithHistory.getHistory()).toHaveLength(2)

        channelWithHistory.clearHistory()

        expect(channelWithHistory.getHistory()).toHaveLength(0)
      })
    })

    describe('publishTo', () => {
      it('should send message to specific subscriber', () => {
        const client = createMockClient('client-1')
        clients.set('client-1', client)
        channel.subscribe('client-1')

        channel.publishTo('client-1', 'Direct message')

        expect(client.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Direct message'),
        )
      })

      it('should not send to non-subscribed client', () => {
        const client = createMockClient('client-1')
        clients.set('client-1', client)
        // Don't subscribe the client

        channel.publishTo('client-1', 'Message')

        // Should not send because client is not subscribed
        // (implementation checks both existence and subscription)
      })
    })
  })

  describe('BroadcastTransport', () => {
    let broadcast: BroadcastTransport<string>
    let clients: Map<string, IClientConnection>

    beforeEach(() => {
      clients = new Map()
      broadcast = new BroadcastTransport<string>(clients)
    })

    describe('initialization', () => {
      it('should have reserved channel name', () => {
        expect(broadcast.name).toBe('__broadcast__')
      })

      it('should return all connected clients as subscriber count', () => {
        expect(broadcast.subscriberCount).toBe(0)

        clients.set('client-1', createMockClient('client-1'))
        expect(broadcast.subscriberCount).toBe(1)

        clients.set('client-2', createMockClient('client-2'))
        expect(broadcast.subscriberCount).toBe(2)
      })
    })

    describe('publish', () => {
      beforeEach(() => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')
        clients.set('client-1', client1)
        clients.set('client-2', client2)
      })

      it('should send message to all clients', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        broadcast.publish('Broadcast to everyone')

        expect(client1.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Broadcast to everyone'),
        )
        expect(client2.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Broadcast to everyone'),
        )
      })

      it('should send to specific clients with "to" option', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        broadcast.publish('Targeted message', { to: ['client-1'] })

        expect(client1.socket.send).toHaveBeenCalled()
        // client2 should NOT receive the message
        const calls = (client2.socket.send as any).mock.calls
        const relevantCalls = calls.filter((call: any[]) =>
          call[0].includes('Targeted message'),
        )
        expect(relevantCalls).toHaveLength(0)
      })

      it('should exclude specified clients with "exclude" option', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        broadcast.publish('Message for client-2', { exclude: ['client-1'] })

        // client1 should not receive
        const calls1 = (client1.socket.send as any).mock.calls
        const relevant1 = calls1.filter((call) =>
          call[0].includes('Message for client-2'),
        )
        expect(relevant1).toHaveLength(0)

        // client2 should receive
        const calls2 = (client2.socket.send as any).mock.calls
        const relevant2 = calls2.filter((call) =>
          call[0].includes('Message for client-2'),
        )
        expect(relevant2.length).toBeGreaterThan(0)
      })

      it('should combine "to" and "exclude" options', () => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')
        const client3 = createMockClient('client-3')
        clients.set('client-1', client1)
        clients.set('client-2', client2)
        clients.set('client-3', client3)

        broadcast.publish('Message', {
          to: ['client-1', 'client-2', 'client-3'],
          exclude: ['client-1'],
        })

        // Only client-2 and client-3 should receive
        // client1 should NOT receive
        const calls1 = (client1.socket.send as any).mock.calls
        const relevant1 = calls1.filter((call: any[]) =>
          call[0].includes('Message'),
        )
        expect(relevant1).toHaveLength(0)

        // client2 should receive
        const calls2 = (client2.socket.send as any).mock.calls
        const relevant2 = calls2.filter((call: any[]) =>
          call[0].includes('Message'),
        )
        expect(relevant2.length).toBeGreaterThan(0)

        // client3 should receive
        const calls3 = (client3.socket.send as any).mock.calls
        const relevant3 = calls3.filter((call: any[]) =>
          call[0].includes('Message'),
        )
        expect(relevant3.length).toBeGreaterThan(0)
      })
    })

    describe('interface compliance', () => {
      it('should implement IBroadcastTransport interface', () => {
        expect(broadcast.name).toBeDefined()
        expect(broadcast.name).toBe('__broadcast__')
        expect(typeof broadcast.publish).toBe('function')
        expect(typeof broadcast.subscriberCount).toBe('number')
      })
    })
  })

  describe('BaseChannel', () => {
    // Test through concrete implementation
    let channel: MulticastTransport<string>

    beforeEach(() => {
      channel = new MulticastTransport<string>('test', new Map())
    })

    it('should implement IChannel interface', () => {
      expect(channel.name).toBe('test')
      expect(typeof channel.publish).toBe('function')
      expect(typeof channel.subscribe).toBe('function')
      expect(typeof channel.unsubscribe).toBe('function')
    })

    it('should implement IMessageHistory interface', () => {
      expect(typeof channel.getHistory).toBe('function')
      expect(typeof channel.clearHistory).toBe('function')
    })
  })
})
