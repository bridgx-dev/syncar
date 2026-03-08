/**
 * Unit tests for channel.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BroadcastChannel, MulticastChannel } from '../src/channel'
import { ClientRegistry } from '../src/registry'
import { MessageType } from '../src/types'
import type { IClientConnection } from '../src/types'

// Mock WebSocket
class MockWebSocket {
  public readyState = 1 // OPEN
  public sent: string[] = []

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3 // CLOSED
  }
}

describe('channel', () => {
  let registry: ClientRegistry
  let mockClients: Map<string, IClientConnection>

  beforeEach(() => {
    registry = new ClientRegistry()
    mockClients = new Map()

    // Create mock clients
    for (let i = 1; i <= 5; i++) {
      const socket = new MockWebSocket() as any
      const client: IClientConnection = {
        id: `client-${i}`,
        connectedAt: Date.now(),
        socket,
      }
      mockClients.set(client.id, client)
      registry.connections.set(client.id, client)
    }
  })

  describe('BroadcastChannel', () => {
    let channel: BroadcastChannel<string>

    beforeEach(() => {
      channel = new BroadcastChannel(registry)
    })

    describe('constructor', () => {
      it('should have the broadcast channel name', () => {
        expect(channel.name).toBe('__broadcast__')
      })

      it('should use default chunk size', () => {
        expect((channel as any).chunkSize).toBe(500)
      })

      it('should use custom chunk size when provided', () => {
        const customChannel = new BroadcastChannel(registry, 100)
        expect((customChannel as any).chunkSize).toBe(100)
      })
    })

    describe('subscriberCount', () => {
      it('should return the number of connected clients', () => {
        expect(channel.subscriberCount).toBe(5)
      })

      it('should update when clients connect/disconnect', () => {
        const socket = new MockWebSocket() as any
        const client: IClientConnection = {
          id: 'client-new',
          connectedAt: Date.now(),
          socket,
        }
        registry.connections.set(client.id, client)

        expect(channel.subscriberCount).toBe(6)

        registry.connections.delete('client-new')
        expect(channel.subscriberCount).toBe(5)
      })
    })

    describe('isEmpty()', () => {
      it('should return false when there are clients', () => {
        expect(channel.isEmpty()).toBe(false)
      })

      it('should return true when there are no clients', () => {
        registry.connections.clear()
        expect(channel.isEmpty()).toBe(true)
      })
    })

    describe('getMiddlewares()', () => {
      it('should return empty array', () => {
        expect(channel.getMiddlewares()).toEqual([])
      })
    })

    describe('publish()', () => {
      it('should publish to all connected clients', () => {
        channel.publish('Hello everyone!')

        for (const [id, client] of mockClients) {
          const sent = (client.socket as MockWebSocket).sent
          expect(sent).toHaveLength(1)
          const message = JSON.parse(sent[0])
          expect(message.type).toBe(MessageType.DATA)
          expect(message.channel).toBe('__broadcast__')
          expect(message.data).toBe('Hello everyone!')
        }
      })

      it('should exclude specified clients', () => {
        channel.publish('Hello!', { exclude: ['client-1', 'client-2'] })

        const client1 = mockClients.get('client-1')!
        const client3 = mockClients.get('client-3')!

        expect((client1.socket as MockWebSocket).sent).toHaveLength(0)
        expect((client3.socket as MockWebSocket).sent).toHaveLength(1)
      })

      it('should send only to specified clients', () => {
        channel.publish('Private message', { to: ['client-1', 'client-2'] })

        const client1 = mockClients.get('client-1')!
        const client3 = mockClients.get('client-3')!

        expect((client1.socket as MockWebSocket).sent).toHaveLength(1)
        expect((client3.socket as MockWebSocket).sent).toHaveLength(0)
      })

      it('should combine to and exclude options', () => {
        channel.publish('Message', { to: ['client-1', 'client-2'], exclude: ['client-2'] })

        const client1 = mockClients.get('client-1')!
        const client2 = mockClients.get('client-2')!

        expect((client1.socket as MockWebSocket).sent).toHaveLength(1)
        expect((client2.socket as MockWebSocket).sent).toHaveLength(0)
      })
    })
  })

  describe('MulticastChannel', () => {
    let channel: MulticastChannel<string>

    beforeEach(() => {
      channel = new MulticastChannel({
        name: 'chat',
        registry,
      })
    })

    describe('constructor', () => {
      it('should have the provided channel name', () => {
        expect(channel.name).toBe('chat')
      })

      it('should use default chunk size', () => {
        expect((channel as any).chunkSize).toBe(500)
      })

      it('should use custom chunk size when provided', () => {
        const customChannel = new MulticastChannel({
          name: 'custom',
          registry,
          options: { chunkSize: 100 },
        })
        expect((customChannel as any).chunkSize).toBe(100)
      })
    })

    describe('subscriberCount', () => {
      it('should return 0 when no one is subscribed', () => {
        expect(channel.subscriberCount).toBe(0)
      })

      it('should return the number of subscribers', () => {
        channel.subscribe('client-1')
        channel.subscribe('client-2')
        channel.subscribe('client-3')

        expect(channel.subscriberCount).toBe(3)
      })
    })

    describe('isEmpty()', () => {
      it('should return true when no subscribers', () => {
        expect(channel.isEmpty()).toBe(true)
      })

      it('should return false when there are subscribers', () => {
        channel.subscribe('client-1')
        expect(channel.isEmpty()).toBe(false)
      })
    })

    describe('subscribe()', () => {
      it('should add a subscriber', () => {
        const result = channel.subscribe('client-1')

        expect(result).toBe(true)
        expect(channel.hasSubscriber('client-1')).toBe(true)
      })

      it('should return true when already subscribed (idempotent)', () => {
        channel.subscribe('client-1')
        const result = channel.subscribe('client-1')

        expect(result).toBe(true)
        expect(channel.subscriberCount).toBe(1)
      })

      it('should add multiple subscribers', () => {
        channel.subscribe('client-1')
        channel.subscribe('client-2')
        channel.subscribe('client-3')

        expect(channel.subscriberCount).toBe(3)
      })
    })

    describe('unsubscribe()', () => {
      it('should remove a subscriber', () => {
        channel.subscribe('client-1')
        const result = channel.unsubscribe('client-1')

        expect(result).toBe(true)
        expect(channel.hasSubscriber('client-1')).toBe(false)
      })

      it('should return false when not subscribed', () => {
        const result = channel.unsubscribe('client-1')

        expect(result).toBe(false)
      })
    })

    describe('hasSubscriber()', () => {
      it('should return true for subscribers', () => {
        channel.subscribe('client-1')
        expect(channel.hasSubscriber('client-1')).toBe(true)
      })

      it('should return false for non-subscribers', () => {
        expect(channel.hasSubscriber('client-1')).toBe(false)
      })
    })

    describe('getSubscribers()', () => {
      it('should return empty set when no subscribers', () => {
        const subscribers = channel.getSubscribers()
        expect(subscribers).toBeInstanceOf(Set)
        expect(subscribers.size).toBe(0)
      })

      it('should return all subscribers', () => {
        channel.subscribe('client-1')
        channel.subscribe('client-2')
        channel.subscribe('client-3')

        const subscribers = channel.getSubscribers()

        expect(subscribers.size).toBe(3)
        expect(subscribers.has('client-1')).toBe(true)
        expect(subscribers.has('client-2')).toBe(true)
        expect(subscribers.has('client-3')).toBe(true)
      })

      it('should return a copy (modifications dont affect channel)', () => {
        channel.subscribe('client-1')

        const subscribers = channel.getSubscribers()
        subscribers.add('client-2')

        expect(channel.hasSubscriber('client-2')).toBe(false)
      })
    })

    describe('publish()', () => {
      beforeEach(() => {
        // Subscribe some clients
        channel.subscribe('client-1')
        channel.subscribe('client-2')
        channel.subscribe('client-3')
      })

      it('should publish to all subscribers', () => {
        channel.publish('Hello chat!')

        const client1 = mockClients.get('client-1')!
        const client2 = mockClients.get('client-2')!
        const client3 = mockClients.get('client-3')!

        expect((client1.socket as MockWebSocket).sent).toHaveLength(1)
        expect((client2.socket as MockWebSocket).sent).toHaveLength(1)
        expect((client3.socket as MockWebSocket).sent).toHaveLength(1)
      })

      it('should not publish to non-subscribers', () => {
        channel.publish('Hello chat!')

        const client4 = mockClients.get('client-4')!
        const client5 = mockClients.get('client-5')!

        expect((client4.socket as MockWebSocket).sent).toHaveLength(0)
        expect((client5.socket as MockWebSocket).sent).toHaveLength(0)
      })

      it('should exclude specified subscribers', () => {
        channel.publish('Hello!', { exclude: ['client-1'] })

        const client1 = mockClients.get('client-1')!
        const client2 = mockClients.get('client-2')!

        expect((client1.socket as MockWebSocket).sent).toHaveLength(0)
        expect((client2.socket as MockWebSocket).sent).toHaveLength(1)
      })

      it('should send only to specified subscribers', () => {
        channel.publish('Private', { to: ['client-1'] })

        const client1 = mockClients.get('client-1')!
        const client2 = mockClients.get('client-2')!

        expect((client1.socket as MockWebSocket).sent).toHaveLength(1)
        expect((client2.socket as MockWebSocket).sent).toHaveLength(0)
      })
    })

    describe('use()', () => {
      it('should register channel middleware', () => {
        const middleware = vi.fn(async (_ctx, next) => next())

        channel.use(middleware)

        expect(channel.getMiddlewares()).toContain(middleware)
      })

      it('should register multiple middleware', () => {
        const mw1 = vi.fn(async (_ctx, next) => next())
        const mw2 = vi.fn(async (_ctx, next) => next())

        channel.use(mw1)
        channel.use(mw2)

        expect(channel.getMiddlewares()).toHaveLength(2)
      })
    })

    describe('getMiddlewares()', () => {
      it('should return all registered middleware', () => {
        const mw1 = vi.fn(async (_ctx, next) => next())
        const mw2 = vi.fn(async (_ctx, next) => next())

        channel.use(mw1)
        channel.use(mw2)

        const middlewares = channel.getMiddlewares()

        expect(middlewares).toEqual([mw1, mw2])
      })

      it('should return a copy', () => {
        const middleware = vi.fn(async (_ctx, next) => next())
        channel.use(middleware)

        const middlewares = channel.getMiddlewares()
        middlewares.push(vi.fn() as any)

        expect(channel.getMiddlewares()).toHaveLength(1)
      })
    })

    describe('onMessage()', () => {
      it('should register message handler', () => {
        const handler = vi.fn()

        const unsubscribe = channel.onMessage(handler)

        expect(typeof unsubscribe).toBe('function')
      })

      it('should call handler when message is dispatched', async () => {
        const handler = vi.fn()

        channel.onMessage(handler)

        const client = mockClients.get('client-1')!
        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }

        await channel.dispatch('hello', client, message)

        expect(handler).toHaveBeenCalledWith('hello', client, message)
      })

      it('should support multiple handlers', async () => {
        const handler1 = vi.fn()
        const handler2 = vi.fn()

        channel.onMessage(handler1)
        channel.onMessage(handler2)

        const client = mockClients.get('client-1')!
        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }

        await channel.dispatch('hello', client, message)

        expect(handler1).toHaveBeenCalled()
        expect(handler2).toHaveBeenCalled()
      })

      it('should allow unsubscribing handler', async () => {
        const handler = vi.fn()

        const unsubscribe = channel.onMessage(handler)
        unsubscribe()

        const client = mockClients.get('client-1')!
        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }

        await channel.dispatch('hello', client, message)

        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe('dispatch()', () => {
      describe('auto-relay mode (no handlers)', () => {
        beforeEach(() => {
          channel.subscribe('client-1')
          channel.subscribe('client-2')
        })

        it('should relay message to all subscribers except sender', async () => {
          const client = mockClients.get('client-1')!
          const message = {
            id: 'msg-1',
            type: MessageType.DATA,
            channel: 'chat',
            data: 'hello from client-1',
            timestamp: Date.now(),
          }

          await channel.dispatch('hello from client-1', client, message)

          // Sender should not receive the relayed message
          expect((client.socket as MockWebSocket).sent).toHaveLength(0)

          // Other subscribers should receive
          const client2 = mockClients.get('client-2')!
          expect((client2.socket as MockWebSocket).sent).toHaveLength(1)
        })

        it('should include data in relayed message', async () => {
          const client = mockClients.get('client-1')!
          const message = {
            id: 'msg-1',
            type: MessageType.DATA,
            channel: 'chat',
            data: { text: 'hello', user: 'alice' },
            timestamp: Date.now(),
          }

          await channel.dispatch({ text: 'hello', user: 'alice' }, client, message)

          const client2 = mockClients.get('client-2')!
          const sent = (client2.socket as MockWebSocket).sent[0]
          const parsed = JSON.parse(sent)

          expect(parsed.data).toEqual({ text: 'hello', user: 'alice' })
        })
      })

      describe('intercept mode (with handlers)', () => {
        it('should not auto-relay when handlers are registered', async () => {
          const handler = vi.fn()
          channel.onMessage(handler)

          channel.subscribe('client-1')
          channel.subscribe('client-2')

          const client = mockClients.get('client-1')!
          const message = {
            id: 'msg-1',
            type: MessageType.DATA,
            channel: 'chat',
            data: 'hello',
            timestamp: Date.now(),
          }

          await channel.dispatch('hello', client, message)

          // No messages should be sent automatically
          const client2 = mockClients.get('client-2')!
          expect((client2.socket as MockWebSocket).sent).toHaveLength(0)

          // Handler should have been called
          expect(handler).toHaveBeenCalled()
        })

        it('should allow handler to manually publish', async () => {
          channel.onMessage(async (data, client) => {
            if (client.id === 'client-1') {
              // Manually publish to other subscribers
              channel.publish(data, { exclude: [client.id] })
            }
          })

          channel.subscribe('client-1')
          channel.subscribe('client-2')

          const client = mockClients.get('client-1')!
          const message = {
            id: 'msg-1',
            type: MessageType.DATA,
            channel: 'chat',
            data: 'hello',
            timestamp: Date.now(),
          }

          await channel.dispatch('hello', client, message)

          // Sender should not receive
          expect((client.socket as MockWebSocket).sent).toHaveLength(0)

          // Other subscribers should receive via handler
          const client2 = mockClients.get('client-2')!
          expect((client2.socket as MockWebSocket).sent).toHaveLength(1)
        })

        it('should handle handler errors gracefully', async () => {
          const handler = vi.fn(async () => {
            throw new Error('Handler error')
          })

          channel.onMessage(handler)

          channel.subscribe('client-1')
          channel.subscribe('client-2')

          const client = mockClients.get('client-1')!
          const message = {
            id: 'msg-1',
            type: MessageType.DATA,
            channel: 'chat',
            data: 'hello',
            timestamp: Date.now(),
          }

          // Should not throw
          await expect(
            channel.dispatch('hello', client, message)
          ).resolves.toBeUndefined()

          expect(handler).toHaveBeenCalled()
        })
      })
    })
  })
})
