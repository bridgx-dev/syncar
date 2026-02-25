/**
 * Channel Tests
 * Tests for broadcast and multicast transport channels
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BaseChannel,
  BroadcastTransport,
  MulticastTransport,
} from '../src/channel/index.js'
import type { IClientConnection } from '../src/types/index.js'

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

    describe('initialization', () => {
      it('should have correct name', () => {
        expect(channel.name).toBe('test')
      })

      it('should have 0 subscribers initially', () => {
        expect(channel.subscriberCount).toBe(0)
      })

      it('should not be reserved by default', () => {
        expect(channel.isReserved()).toBe(false)
      })

      it('should be empty initially', () => {
        expect(channel.isEmpty()).toBe(true)
      })

      it('should not be full initially', () => {
        expect(channel.isFull()).toBe(false)
      })
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
        const client2 = clients.get('client-2')!
        expect(client2.socket.send).not.toHaveBeenCalled()
      })

      it('should exclude specified subscribers with "exclude" option', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        channel.publish('Message for client-2', { exclude: ['client-1'] })

        // client1 should NOT receive the message
        expect(client1.socket.send).not.toHaveBeenCalledWith(
          expect.stringContaining('Message for client-2'),
        )

        // client2 should receive
        expect(client2.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Message for client-2'),
        )
      })

      it('should combine "to" and "exclude" options', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        channel.publish('Message', {
          to: ['client-1', 'client-2'],
          exclude: ['client-1'],
        })

        // client1 should NOT receive
        expect(client1.socket.send).not.toHaveBeenCalled()

        // client2 should receive
        expect(client2.socket.send).toHaveBeenCalled()
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
        expect(client.socket.send).not.toHaveBeenCalled()
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

      it('should update lastMessageAt after publish', () => {
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

        const reservedChannel = new MulticastTransport<string>(
          '__private__',
          clients,
          {
            reserved: true,
          },
        )

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

    describe('handlers', () => {
      it('should register and call onMessage handler', async () => {
        let receivedData: string | undefined
        let receivedClient: IClientConnection | undefined

        const unsubscribe = channel.onMessage((data, client) => {
          receivedData = data
          receivedClient = client
        })

        expect(typeof unsubscribe).toBe('function')

        const client = createMockClient('client-1')
        const message = {
          id: 'msg-1',
          type: 'data',
          channel: 'test',
          data: 'test data',
          timestamp: Date.now(),
        } as const

        await channel.receive('test data', client, message as any)

        expect(receivedData).toBe('test data')
        expect(receivedClient).toBeDefined()
      })

      it('should register and call onSubscribe handler', async () => {
        let receivedClient: IClientConnection | undefined

        const unsubscribe = channel.onSubscribe((client) => {
          receivedClient = client
        })

        const client = createMockClient('client-1')

        await channel.handleSubscribe(client)

        expect(receivedClient).toBeDefined()
      })

      it('should register and call onUnsubscribe handler', async () => {
        let receivedClient: IClientConnection | undefined

        const unsubscribe = channel.onUnsubscribe((client) => {
          receivedClient = client
        })

        const client = createMockClient('client-1')

        await channel.handleUnsubscribe(client)

        expect(receivedClient).toBeDefined()
      })

      it('should remove handler when unsubscribe function is called', () => {
        const handler = vi.fn()
        const unsubscribe = channel.onMessage(handler)

        unsubscribe()

        // Handler should be removed
        const handlers = (channel as any).messageHandlers
        expect(handlers.has(handler)).toBe(false)
      })
    })

    describe('clear', () => {
      it('should clear all subscribers', () => {
        channel.subscribe('client-1')
        channel.subscribe('client-2')

        expect(channel.subscriberCount).toBe(2)

        channel.clear()

        expect(channel.subscriberCount).toBe(0)
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

      it('should always return true for subscribe', () => {
        expect(broadcast.subscribe('client-1')).toBe(true)
        expect(broadcast.subscribe('client-1')).toBe(true) // Duplicate still returns true
      })

      it('should always return true for unsubscribe', () => {
        expect(broadcast.unsubscribe('client-1')).toBe(true)
        expect(broadcast.unsubscribe('client-1')).toBe(true) // Non-existent still returns true
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

        broadcast.publish('Targeted message', { to: ['client-1'] })

        expect(client1.socket.send).toHaveBeenCalled()
        // client2 should NOT receive the message
        const client2 = clients.get('client-2')!
        expect(client2.socket.send).not.toHaveBeenCalled()
      })

      it('should exclude specified clients with "exclude" option', () => {
        const client1 = clients.get('client-1')!
        const client2 = clients.get('client-2')!

        broadcast.publish('Message for client-2', { exclude: ['client-1'] })

        // client1 should not receive
        expect(client1.socket.send).not.toHaveBeenCalledWith(
          expect.stringContaining('Message for client-2'),
        )

        // client2 should receive
        expect(client2.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('Message for client-2'),
        )
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
        expect(client1.socket.send).not.toHaveBeenCalled()

        expect(client2.socket.send).toHaveBeenCalled()
        expect(client3.socket.send).toHaveBeenCalled()
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
