/**
 * Handlers Tests
 * Tests for connection, message, and signal handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ConnectionHandler,
  MessageHandler,
  SignalHandler,
} from '../src/handlers/index.js'
import { ClientRegistry } from '../src/registry/index.js'
import { MiddlewareManager } from '../src/middleware/index.js'
import { EventEmitter } from '../src/emitter/index.js'
import { MulticastTransport } from '../src/channel/index.js'
import type {
  IClientConnection,
  IServerClient,
  IServerTransport,
  DataMessage,
  SignalMessage,
  IServerEventMap,
} from '../src/types/index.js'
import { MessageType, SignalType } from '@synnel/types'
import { CLOSE_CODES } from '../src/config/index.js'
import { ChannelError, MessageError } from '../src/errors/index.js'

// Helper function to create data messages
function createDataMessage<T>(channel: string, data: T, id?: string): DataMessage<T> {
  return {
    id: id || `msg-${Date.now()}`,
    type: MessageType.DATA,
    channel,
    data,
    timestamp: Date.now(),
  }
}

// Helper function to create signal messages
function createSignalMessage(
  channel: string,
  signal: SignalType,
  data?: unknown,
): SignalMessage {
  return {
    id: `sig-${Date.now()}`,
    type: MessageType.SIGNAL,
    channel,
    signal,
    data,
    timestamp: Date.now(),
  }
}

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

describe('Handlers', () => {
  describe('ConnectionHandler', () => {
    let handler: ConnectionHandler
    let registry: ClientRegistry
    let middleware: MiddlewareManager
    let emitter: EventEmitter<IServerEventMap>

    beforeEach(() => {
      registry = new ClientRegistry()
      middleware = new MiddlewareManager()
      emitter = new EventEmitter<IServerEventMap>()

      handler = new ConnectionHandler({
        registry,
        middleware,
        emitter,
      })
    })

    describe('handleConnection', () => {
      it('should register client and return server client', async () => {
        const connection = createMockConnection('client-1')

        const client = await handler.handleConnection(connection)

        expect(client).toBeDefined()
        expect(client.id).toBe('client-1')
        expect(registry.getCount()).toBe(1)
      })

      it('should execute connection middleware', async () => {
        const connection = createMockConnection('client-1')
        const middlewareSpy = vi.fn()

        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        await handler.handleConnection(connection)

        expect(middlewareSpy).toHaveBeenCalledWith('connect')
      })

      it('should emit connection event', async () => {
        const connection = createMockConnection('client-1')
        const eventSpy = vi.fn()

        emitter.on('connection', eventSpy)

        await handler.handleConnection(connection)

        expect(eventSpy).toHaveBeenCalledTimes(1)
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'client-1' }),
        )
      })

      it('should not emit event when emitConnectionEvent is false', async () => {
        const handlerNoEmit = new ConnectionHandler({
          registry,
          middleware,
          emitter,
          options: { emitConnectionEvent: false },
        })

        const connection = createMockConnection('client-1')
        const eventSpy = vi.fn()

        emitter.on('connection', eventSpy)

        await handlerNoEmit.handleConnection(connection)

        expect(eventSpy).not.toHaveBeenCalled()
      })

      it('should reject and disconnect when middleware rejects', async () => {
        const connection = createMockConnection('client-1')

        middleware.use(async ({ reject }) => {
          reject('Not authorized')
        })

        await expect(handler.handleConnection(connection)).rejects.toThrow(
          'Connection rejected by middleware',
        )

        expect(registry.getCount()).toBe(0)
        expect(connection.socket.close).toHaveBeenCalledWith(
          CLOSE_CODES.REJECTED,
          'Connection rejected',
        )
      })

      it('should use custom rejection close code', async () => {
        const handlerCustom = new ConnectionHandler({
          registry,
          middleware,
          emitter,
          options: { rejectionCloseCode: 4003 },
        })

        const connection = createMockConnection('client-1')

        middleware.use(async ({ reject }) => {
          reject('Rejected')
        })

        try {
          await handlerCustom.handleConnection(connection)
        } catch {
          // Expected error
        }

        expect(connection.socket.close).toHaveBeenCalledWith(4003, 'Connection rejected')
      })
    })

    describe('handleDisconnection', () => {
      it('should unregister client', async () => {
        const connection = createMockConnection('client-1')
        await handler.handleConnection(connection)

        expect(registry.getCount()).toBe(1)

        await handler.handleDisconnection('client-1')

        expect(registry.getCount()).toBe(0)
      })

      it('should execute disconnect middleware', async () => {
        const connection = createMockConnection('client-1')
        await handler.handleConnection(connection)

        const middlewareSpy = vi.fn()
        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        await handler.handleDisconnection('client-1')

        expect(middlewareSpy).toHaveBeenCalledWith('disconnect')
      })

      it('should emit disconnection event', async () => {
        const connection = createMockConnection('client-1')
        await handler.handleConnection(connection)

        const eventSpy = vi.fn()
        emitter.on('disconnection', eventSpy)

        await handler.handleDisconnection('client-1')

        expect(eventSpy).toHaveBeenCalledTimes(1)
      })

      it('should not emit event when emitDisconnectionEvent is false', async () => {
        const handlerNoEmit = new ConnectionHandler({
          registry,
          middleware,
          emitter,
          options: { emitDisconnectionEvent: false },
        })

        const connection = createMockConnection('client-1')
        await handlerNoEmit.handleConnection(connection)

        const eventSpy = vi.fn()
        emitter.on('disconnection', eventSpy)

        await handlerNoEmit.handleDisconnection('client-1')

        expect(eventSpy).not.toHaveBeenCalled()
      })

      it('should handle non-existent client gracefully', async () => {
        // Should not throw
        await handler.handleDisconnection('non-existent')
      })

      it('should ignore middleware errors during disconnection', async () => {
        const connection = createMockConnection('client-1')
        await handler.handleConnection(connection)

        middleware.use(async () => {
          throw new Error('Middleware error')
        })

        // Should not throw
        await handler.handleDisconnection('client-1')

        expect(registry.getCount()).toBe(0)
      })
    })

    describe('getOptions', () => {
      it('should return handler options', () => {
        const options = handler.getOptions()

        expect(options.emitConnectionEvent).toBe(true)
        expect(options.emitDisconnectionEvent).toBe(true)
        expect(options.rejectionCloseCode).toBe(CLOSE_CODES.REJECTED)
      })

      it('should return custom options', () => {
        const customHandler = new ConnectionHandler({
          registry,
          middleware,
          emitter,
          options: {
            emitConnectionEvent: false,
            rejectionCloseCode: 4003,
          },
        })

        const options = customHandler.getOptions()

        expect(options.emitConnectionEvent).toBe(false)
        expect(options.rejectionCloseCode).toBe(4003)
      })
    })
  })

  describe('MessageHandler', () => {
    let handler: MessageHandler
    let registry: ClientRegistry
    let middleware: MiddlewareManager
    let emitter: EventEmitter<IServerEventMap>
    let channel: MulticastTransport<string>

    beforeEach(() => {
      registry = new ClientRegistry()
      middleware = new MiddlewareManager()
      emitter = new EventEmitter<IServerEventMap>()

      // Create a test channel
      channel = new MulticastTransport<string>('test', registry.connections)
      registry.registerChannel(channel)

      handler = new MessageHandler({
        registry,
        middleware,
        emitter,
      })
    })

    describe('handleMessage', () => {
      it('should route message to channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'test')

        const channelSpy = vi.spyOn(channel, 'receive').mockResolvedValue()

        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        await handler.handleMessage(client, message)

        expect(channelSpy).toHaveBeenCalledWith('Hello', client, message)
      })

      it('should execute message middleware', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const middlewareSpy = vi.fn()
        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        await handler.handleMessage(client, message)

        expect(middlewareSpy).toHaveBeenCalledWith('message')
      })

      it('should emit message event', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'test')

        const eventSpy = vi.fn()
        emitter.on('message', eventSpy)

        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        await handler.handleMessage(client, message)

        expect(eventSpy).toHaveBeenCalledWith(client, message)
      })

      it('should throw error for invalid message type', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const invalidMessage = {
          id: 'msg-1',
          type: 'invalid',
          channel: 'test',
          data: 'test',
          timestamp: Date.now(),
        } as any

        await expect(
          handler.handleMessage(client, invalidMessage),
        ).rejects.toThrow(MessageError)
      })

      it('should throw error when channel not found and requireChannel is true', async () => {
        const handlerStrict = new MessageHandler({
          registry,
          middleware,
          emitter,
          options: { requireChannel: true },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: DataMessage<string> = createDataMessage('nonexistent', 'Hello')

        await expect(
          handlerStrict.handleMessage(client, message),
        ).rejects.toThrow(ChannelError)
      })

      it('should not throw when channel not found and requireChannel is false', async () => {
        const handlerLenient = new MessageHandler({
          registry,
          middleware,
          emitter,
          options: { requireChannel: false },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: DataMessage<string> = createDataMessage('nonexistent', 'Hello')

        // Should not throw
        await handlerLenient.handleMessage(client, message)
      })
    })

    describe('canProcessMessage', () => {
      it('should return true for valid message with existing channel', () => {
        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        expect(handler.canProcessMessage(message)).toBe(true)
      })

      it('should return false for invalid message type', () => {
        const invalidMessage = {
          id: 'msg-1',
          type: 'invalid',
          channel: 'test',
          data: 'test',
          timestamp: Date.now(),
        } as any

        expect(handler.canProcessMessage(invalidMessage)).toBe(false)
      })

      it('should return false for non-existent channel when requireChannel is true', () => {
        const message: DataMessage<string> = createDataMessage('nonexistent', 'Hello')

        expect(handler.canProcessMessage(message)).toBe(false)
      })

      it('should return true for non-existent channel when requireChannel is false', () => {
        const handlerLenient = new MessageHandler({
          registry,
          middleware,
          emitter,
          options: { requireChannel: false },
        })

        const message: DataMessage<string> = createDataMessage('nonexistent', 'Hello')

        expect(handlerLenient.canProcessMessage(message)).toBe(true)
      })
    })

    describe('getChannelForMessage', () => {
      it('should return channel for message', () => {
        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        const found = handler.getChannelForMessage(message)

        expect(found).toBe(channel)
      })

      it('should return undefined for non-existent channel', () => {
        const message: DataMessage<string> = createDataMessage('nonexistent', 'Hello')

        const found = handler.getChannelForMessage(message)

        expect(found).toBeUndefined()
      })
    })

    describe('getOptions', () => {
      it('should return handler options', () => {
        const options = handler.getOptions()

        expect(options.emitMessageEvent).toBe(true)
        expect(options.requireChannel).toBe(true)
        expect(options.executeMiddleware).toBe(true)
      })

      it('should return custom options', () => {
        const customHandler = new MessageHandler({
          registry,
          middleware,
          emitter,
          options: {
            emitMessageEvent: false,
            requireChannel: false,
          },
        })

        const options = customHandler.getOptions()

        expect(options.emitMessageEvent).toBe(false)
        expect(options.requireChannel).toBe(false)
      })
    })
  })

  describe('SignalHandler', () => {
    let handler: SignalHandler
    let registry: ClientRegistry
    let middleware: MiddlewareManager
    let emitter: EventEmitter<IServerEventMap>
    let channel: MulticastTransport<string>

    beforeEach(() => {
      registry = new ClientRegistry()
      middleware = new MiddlewareManager()
      emitter = new EventEmitter<IServerEventMap>()

      // Create a test channel
      channel = new MulticastTransport<string>('chat', registry.connections)
      registry.registerChannel(channel)

      handler = new SignalHandler({
        registry,
        middleware,
        emitter,
      })
    })

    describe('handleSignal', () => {
      it('should route subscribe signal to handleSubscribe', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const subscribeSpy = vi.spyOn(handler, 'handleSubscribe')

        const message: SignalMessage = createSignalMessage('chat', SignalType.SUBSCRIBE)

        await handler.handleSignal(client, message)

        expect(subscribeSpy).toHaveBeenCalledWith(client, message)
      })

      it('should route unsubscribe signal to handleUnsubscribe', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'chat')

        const unsubscribeSpy = vi.spyOn(handler, 'handleUnsubscribe')

        const message: SignalMessage = createSignalMessage('chat', SignalType.UNSUBSCRIBE)

        await handler.handleSignal(client, message)

        expect(unsubscribeSpy).toHaveBeenCalledWith(client, message)
      })

      it('should route ping signal to handlePing', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const pingSpy = vi.spyOn(handler, 'handlePing')

        const message: SignalMessage = createSignalMessage('', SignalType.PING)

        await handler.handleSignal(client, message)

        expect(pingSpy).toHaveBeenCalledWith(client, message)
      })

      it('should route pong signal to handlePong', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const pongSpy = vi.spyOn(handler, 'handlePong')

        const message: SignalMessage = createSignalMessage('', SignalType.PONG)

        await handler.handleSignal(client, message)

        expect(pongSpy).toHaveBeenCalledWith(client, message)
      })

      it('should throw error for unknown signal type', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = {
          id: 'sig-1',
          type: MessageType.SIGNAL,
          channel: '',
          signal: 'unknown' as SignalType,
          data: undefined,
          timestamp: Date.now(),
        }

        await expect(
          handler.handleSignal(client, message),
        ).rejects.toThrow(MessageError)
      })
    })

    describe('handleSubscribe', () => {
      it('should subscribe client to channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('chat', SignalType.SUBSCRIBE)

        await handler.handleSubscribe(client, message)

        expect(channel.hasSubscriber('client-1')).toBe(true)
      })

      it('should execute subscribe middleware', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const middlewareSpy = vi.fn()
        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        const message: SignalMessage = createSignalMessage('chat', SignalType.SUBSCRIBE)

        await handler.handleSubscribe(client, message)

        expect(middlewareSpy).toHaveBeenCalledWith(SignalType.SUBSCRIBE)
      })

      it('should emit subscribe event', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const eventSpy = vi.fn()
        emitter.on('subscribe', eventSpy)

        const message: SignalMessage = createSignalMessage('chat', SignalType.SUBSCRIBE)

        await handler.handleSubscribe(client, message)

        expect(eventSpy).toHaveBeenCalledWith(client, 'chat')
      })

      it('should send subscribed acknowledgment', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('chat', SignalType.SUBSCRIBE)

        await handler.handleSubscribe(client, message)

        expect(connection.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('"signal":"subscribed"'),
          expect.any(Function)
        )
      })

      it('should throw error for reserved channel', async () => {
        // Create a reserved channel
        const reservedChannel = new MulticastTransport<string>(
          '__private__',
          registry.connections,
          { reserved: true },
        )
        registry.registerChannel(reservedChannel)

        const handlerStrict = new SignalHandler({
          registry,
          middleware,
          emitter,
          options: { allowReservedChannels: false },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('__private__', SignalType.SUBSCRIBE)

        const error = await handlerStrict
          .handleSubscribe(client, message)
          .catch((e) => e)

        expect(error).toBeInstanceOf(ChannelError)
        expect(error.message).toContain('Cannot subscribe to reserved channel')
      })

      it('should throw error for broadcast channel', async () => {
        // Create a handler that allows reserved channels so we can test
        // the broadcast channel check specifically
        const handlerWithAllowReserved = new SignalHandler({
          registry,
          middleware,
          emitter,
          options: { allowReservedChannels: true },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('__broadcast__', SignalType.SUBSCRIBE)

        await expect(
          handlerWithAllowReserved.handleSubscribe(client, message),
        ).rejects.toThrow('Cannot subscribe to broadcast channel')
      })

      it('should throw error for non-existent channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('nonexistent', SignalType.SUBSCRIBE)

        await expect(
          handler.handleSubscribe(client, message),
        ).rejects.toThrow(ChannelError)
      })

      it('should throw error when channel is full', async () => {
        // Create a channel with max subscribers = 1
        const fullChannel = new MulticastTransport<string>(
          'full-channel',
          registry.connections,
          { maxSubscribers: 1 },
        )
        registry.registerChannel(fullChannel)

        const conn1 = createMockConnection('client-1')
        registry.register(conn1)
        registry.subscribe('client-1', 'full-channel')

        const conn2 = createMockConnection('client-2')
        const client2 = registry.register(conn2)

        const message: SignalMessage = createSignalMessage('full-channel', SignalType.SUBSCRIBE)

        await expect(
          handler.handleSubscribe(client2, message),
        ).rejects.toThrow('Channel is full')
      })

      it('should throw error when registry subscribe fails', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const subscribeSpy = vi
          .spyOn(registry, 'subscribe')
          .mockReturnValue(false)

        const message: SignalMessage = createSignalMessage('chat', SignalType.SUBSCRIBE)

        await expect(
          handler.handleSubscribe(client, message),
        ).rejects.toThrow('Failed to subscribe')

        subscribeSpy.mockRestore()
      })
    })

    describe('handleUnsubscribe', () => {
      it('should unsubscribe client from channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'chat')

        const message: SignalMessage = createSignalMessage('chat', SignalType.UNSUBSCRIBE)

        await handler.handleUnsubscribe(client, message)

        expect(channel.hasSubscriber('client-1')).toBe(false)
      })

      it('should execute unsubscribe middleware', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'chat')

        const middlewareSpy = vi.fn()
        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        const message: SignalMessage = createSignalMessage('chat', SignalType.UNSUBSCRIBE)

        await handler.handleUnsubscribe(client, message)

        expect(middlewareSpy).toHaveBeenCalledWith(SignalType.UNSUBSCRIBE)
      })

      it('should emit unsubscribe event', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'chat')

        const eventSpy = vi.fn()
        emitter.on('unsubscribe', eventSpy)

        const message: SignalMessage = createSignalMessage('chat', SignalType.UNSUBSCRIBE)

        await handler.handleUnsubscribe(client, message)

        expect(eventSpy).toHaveBeenCalledWith(client, 'chat')
      })

      it('should send unsubscribed acknowledgment', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)
        registry.subscribe('client-1', 'chat')

        const message: SignalMessage = createSignalMessage('chat', SignalType.UNSUBSCRIBE)

        await handler.handleUnsubscribe(client, message)

        expect(connection.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('"signal":"unsubscribed"'),
          expect.any(Function)
        )
      })

      it('should throw error when client not subscribed', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('chat', SignalType.UNSUBSCRIBE)

        await expect(
          handler.handleUnsubscribe(client, message),
        ).rejects.toThrow(ChannelError)
      })
    })

    describe('handlePing', () => {
      it('should send pong response', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('', SignalType.PING)

        await handler.handlePing(client, message)

        expect(connection.socket.send).toHaveBeenCalledWith(
          expect.stringContaining('"signal":"pong"'),
          expect.any(Function)
        )
      })

      it('should not send pong when autoRespondToPing is false', async () => {
        const handlerNoAuto = new SignalHandler({
          registry,
          middleware,
          emitter,
          options: { autoRespondToPing: false },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('', SignalType.PING)

        await handlerNoAuto.handlePing(client, message)

        expect(connection.socket.send).not.toHaveBeenCalled()
      })
    })

    describe('handlePong', () => {
      it('should handle pong without error', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection)

        const message: SignalMessage = createSignalMessage('', SignalType.PONG)

        // Should not throw
        await handler.handlePong(client, message)
      })
    })
  })
})
