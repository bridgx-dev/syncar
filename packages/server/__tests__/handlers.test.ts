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
} from '../src/types/index.js'
import type { ServerClient } from '../src/types/index.js'
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
  inReplyTo?: string,
): SignalMessage {
  return {
    id: `sig-${Date.now()}`,
    type: MessageType.SIGNAL,
    channel,
    signal,
    data,
    timestamp: Date.now(),
    inReplyTo,
  }
}

// Mock connection
function createMockConnection(id: string): IClientConnection {
  return {
    id,
    socket: {
      send: vi.fn(),
      close: vi.fn(),
    } as any,
    status: 'connected',
    connectedAt: Date.now(),
    lastPingAt: undefined,
  }
}

// Mock transport
function createMockTransport(): IServerTransport {
  const connections = new Map()
  return {
    connections,
    sendToClient: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  }
}

// Mock client wrapper
function createMockClient(id: string): Partial<ServerClient> {
  return {
    id,
    send: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(true),
    isSubscribed: vi.fn().mockReturnValue(false),
    getSubscriptions: vi.fn().mockReturnValue([]),
    getConnection: vi.fn(),
  }
}

describe('Handlers', () => {
  describe('ConnectionHandler', () => {
    let handler: ConnectionHandler
    let registry: ClientRegistry
    let middleware: MiddlewareManager
    let emitter: EventEmitter
    let transport: IServerTransport

    beforeEach(() => {
      registry = new ClientRegistry()
      middleware = new MiddlewareManager()
      emitter = new EventEmitter()
      transport = createMockTransport()

      handler = new ConnectionHandler({
        registry,
        middleware,
        emitter,
        transport,
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
          transport,
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
          transport,
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
          transport,
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
          transport,
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
    let emitter: EventEmitter
    let channel: MulticastTransport<string>

    beforeEach(() => {
      registry = new ClientRegistry()
      middleware = new MiddlewareManager()
      emitter = new EventEmitter()

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
        const client = registry.register(connection, createMockTransport())
        registry.subscribe('client-1', 'test')

        const channelSpy = vi.spyOn(channel, 'receive').mockResolvedValue()

        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        await handler.handleMessage(client, message)

        expect(channelSpy).toHaveBeenCalledWith('Hello', client, message)
      })

      it('should execute message middleware', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, createMockTransport())

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
        const client = registry.register(connection, createMockTransport())
        registry.subscribe('client-1', 'test')

        const eventSpy = vi.fn()
        emitter.on('message', eventSpy)

        const message: DataMessage<string> = createDataMessage('test', 'Hello')

        await handler.handleMessage(client, message)

        expect(eventSpy).toHaveBeenCalledWith(client, message)
      })

      it('should throw error for invalid message type', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, createMockTransport())

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
        const client = registry.register(connection, createMockTransport())

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
        const client = registry.register(connection, createMockTransport())

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
    let emitter: EventEmitter
    let transport: IServerTransport
    let channel: MulticastTransport<string>

    beforeEach(() => {
      registry = new ClientRegistry()
      middleware = new MiddlewareManager()
      emitter = new EventEmitter()
      transport = createMockTransport()

      // Create a test channel
      channel = new MulticastTransport<string>('chat', registry.connections)
      registry.registerChannel(channel)

      handler = new SignalHandler({
        registry,
        middleware,
        emitter,
        sendToClient: transport.sendToClient.bind(transport),
      })
    })

    describe('handleSignal', () => {
      it('should route subscribe signal to handleSubscribe', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const subscribeSpy = vi.spyOn(handler, 'handleSubscribe')

        const message: SignalMessage = createSignalMessage('chat', 'subscribe')

        await handler.handleSignal(client, message)

        expect(subscribeSpy).toHaveBeenCalledWith(client, message)
      })

      it('should route unsubscribe signal to handleUnsubscribe', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)
        registry.subscribe('client-1', 'chat')

        const unsubscribeSpy = vi.spyOn(handler, 'handleUnsubscribe')

        const message: SignalMessage = createSignalMessage('chat', 'unsubscribe')

        await handler.handleSignal(client, message)

        expect(unsubscribeSpy).toHaveBeenCalledWith(client, message)
      })

      it('should route ping signal to handlePing', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const pingSpy = vi.spyOn(handler, 'handlePing')

        const message: SignalMessage = createSignalMessage('', 'ping')

        await handler.handleSignal(client, message)

        expect(pingSpy).toHaveBeenCalledWith(client, message)
      })

      it('should route pong signal to handlePong', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const pongSpy = vi.spyOn(handler, 'handlePong')

        const message: SignalMessage = createSignalMessage('', 'pong')

        await handler.handleSignal(client, message)

        expect(pongSpy).toHaveBeenCalledWith(client, message)
      })

      it('should throw error for unknown signal type', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

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
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('chat', 'subscribe')

        await handler.handleSubscribe(client, message)

        expect(channel.hasSubscriber('client-1')).toBe(true)
      })

      it('should execute subscribe middleware', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const middlewareSpy = vi.fn()
        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        const message: SignalMessage = createSignalMessage('chat', 'subscribe')

        await handler.handleSubscribe(client, message)

        expect(middlewareSpy).toHaveBeenCalledWith('subscribe')
      })

      it('should emit subscribe event', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const eventSpy = vi.fn()
        emitter.on('subscribe', eventSpy)

        const message: SignalMessage = createSignalMessage('chat', 'subscribe')

        await handler.handleSubscribe(client, message)

        expect(eventSpy).toHaveBeenCalledWith(client, 'chat')
      })

      it('should send subscribed acknowledgment', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('chat', 'subscribe')

        await handler.handleSubscribe(client, message)

        expect(transport.sendToClient).toHaveBeenCalledWith(
          'client-1',
          expect.objectContaining({
            type: MessageType.SIGNAL,
            signal: 'subscribed',
          }),
        )
      })

      it('should throw error for reserved channel', async () => {
        const handlerStrict = new SignalHandler({
          registry,
          middleware,
          emitter,
          sendToClient: transport.sendToClient.bind(transport),
          options: { allowReservedChannels: false },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('__private__', 'subscribe')

        await expect(
          handlerStrict.handleSubscribe(client, message),
        ).rejects.toThrow(ChannelError)
      })

      it('should throw error for broadcast channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('__broadcast__', 'subscribe')

        await expect(
          handler.handleSubscribe(client, message),
        ).rejects.toThrow(ChannelError)
      })

      it('should throw error for non-existent channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('nonexistent', 'subscribe')

        await expect(
          handler.handleSubscribe(client, message),
        ).rejects.toThrow(ChannelError)
      })
    })

    describe('handleUnsubscribe', () => {
      it('should unsubscribe client from channel', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)
        registry.subscribe('client-1', 'chat')

        const message: SignalMessage = createSignalMessage('chat', 'unsubscribe')

        await handler.handleUnsubscribe(client, message)

        expect(channel.hasSubscriber('client-1')).toBe(false)
      })

      it('should execute unsubscribe middleware', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)
        registry.subscribe('client-1', 'chat')

        const middlewareSpy = vi.fn()
        middleware.use(async ({ action }) => {
          middlewareSpy(action)
        })

        const message: SignalMessage = createSignalMessage('chat', 'unsubscribe')

        await handler.handleUnsubscribe(client, message)

        expect(middlewareSpy).toHaveBeenCalledWith('unsubscribe')
      })

      it('should emit unsubscribe event', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)
        registry.subscribe('client-1', 'chat')

        const eventSpy = vi.fn()
        emitter.on('unsubscribe', eventSpy)

        const message: SignalMessage = createSignalMessage('chat', 'unsubscribe')

        await handler.handleUnsubscribe(client, message)

        expect(eventSpy).toHaveBeenCalledWith(client, 'chat')
      })

      it('should send unsubscribed acknowledgment', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)
        registry.subscribe('client-1', 'chat')

        const message: SignalMessage = createSignalMessage('chat', 'unsubscribe')

        await handler.handleUnsubscribe(client, message)

        expect(transport.sendToClient).toHaveBeenCalledWith(
          'client-1',
          expect.objectContaining({
            type: MessageType.SIGNAL,
            signal: 'unsubscribed',
          }),
        )
      })

      it('should throw error when client not subscribed', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('chat', 'unsubscribe')

        await expect(
          handler.handleUnsubscribe(client, message),
        ).rejects.toThrow(ChannelError)
      })
    })

    describe('handlePing', () => {
      it('should send pong response', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('', 'ping', undefined, 'ping-123')

        await handler.handlePing(client, message)

        expect(transport.sendToClient).toHaveBeenCalledWith(
          'client-1',
          expect.objectContaining({
            type: MessageType.SIGNAL,
            signal: 'pong',
            channel: '',
          }),
        )
      })

      it('should not send pong when autoRespondToPing is false', async () => {
        const handlerNoAuto = new SignalHandler({
          registry,
          middleware,
          emitter,
          sendToClient: transport.sendToClient.bind(transport),
          options: { autoRespondToPing: false },
        })

        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('', 'ping')

        await handlerNoAuto.handlePing(client, message)

        expect(transport.sendToClient).not.toHaveBeenCalled()
      })
    })

    describe('handlePong', () => {
      it('should handle pong without error', async () => {
        const connection = createMockConnection('client-1')
        const client = registry.register(connection, transport)

        const message: SignalMessage = createSignalMessage('', 'pong')

        // Should not throw
        await handler.handlePong(client, message)
      })
    })

    describe('getOptions', () => {
      it('should return handler options', () => {
        const options = handler.getOptions()

        expect(options.emitSubscribeEvent).toBe(true)
        expect(options.emitUnsubscribeEvent).toBe(true)
        expect(options.allowReservedChannels).toBe(false)
        expect(options.sendAcknowledgments).toBe(true)
        expect(options.autoRespondToPing).toBe(true)
      })

      it('should return custom options', () => {
        const customHandler = new SignalHandler({
          registry,
          middleware,
          emitter,
          sendToClient: transport.sendToClient.bind(transport),
          options: {
            emitSubscribeEvent: false,
            allowReservedChannels: true,
          },
        })

        const options = customHandler.getOptions()

        expect(options.emitSubscribeEvent).toBe(false)
        expect(options.allowReservedChannels).toBe(true)
      })
    })
  })
})
