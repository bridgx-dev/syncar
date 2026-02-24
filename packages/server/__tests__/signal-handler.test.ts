/**
 * SignalHandler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SignalHandler } from '../src/handlers/index.js'
import { ClientRegistry } from '../src/registry/index.js'
import { MiddlewareManager } from '../src/middleware/index.js'
import { EventEmitter } from '../src/emitter/index.js'
import { MulticastTransport } from '../src/channel/index.js'
import type { IServerClient } from '../src/types/index.js'
import { createSignalMessage, createDataMessage } from '@synnel/lib'
import type { SignalMessage } from '@synnel/types'
import { ChannelError, MessageError } from '../src/errors/index.js'
import { BROADCAST_CHANNEL } from '../src/types/index.js'

// Mock IServerClient
function createMockClient(id: string): IServerClient {
  return {
    id,
    status: 'connected',
    connectedAt: Date.now(),
    metadata: {},
    send: vi.fn(),
    subscribe: vi.fn((channel) => {
      // Mock subscription in registry
      return true
    }),
    unsubscribe: vi.fn(),
    isSubscribed: vi.fn(() => false),
    getSubscriptions: vi.fn(() => []),
    getConnection: vi.fn(),
    disconnect: vi.fn(),
  }
}

// Mock sendToClient function
const mockSendToClient = vi.fn()

describe('SignalHandler', () => {
  let handler: SignalHandler
  let registry: ClientRegistry
  let middleware: MiddlewareManager
  let emitter: EventEmitter
  let channels: Map<string, any>
  let mockClient: IServerClient

  beforeEach(() => {
    registry = new ClientRegistry()
    middleware = new MiddlewareManager()
    emitter = new EventEmitter()
    channels = new Map()
    mockClient = createMockClient('client-1')
    mockSendToClient.mockClear()

    // Create test channels
    const testChannel = new MulticastTransport<string>('test', new Map())
    const presenceChannel = new MulticastTransport<string>('presence', new Map())
    channels.set('test', testChannel)
    channels.set('presence', presenceChannel)

    handler = new SignalHandler({
      registry,
      middleware,
      emitter,
      channels,
      sendToClient: mockSendToClient,
    })
  })

  describe('handleSignal', () => {
    it('should route subscribe signal to handleSubscribe', async () => {
      const message = createSignalMessage('test', 'subscribe')

      await expect(handler.handleSignal(mockClient, message)).resolves.not.toThrow()
    })

    it('should route unsubscribe signal to handleUnsubscribe', async () => {
      const message = createSignalMessage('test', 'unsubscribe')

      await expect(handler.handleSignal(mockClient, message)).resolves.not.toThrow()
    })

    it('should route ping signal to handlePing', async () => {
      const message = createSignalMessage(BROADCAST_CHANNEL, 'ping')

      await expect(handler.handleSignal(mockClient, message)).resolves.not.toThrow()
    })

    it('should route pong signal to handlePong', async () => {
      const message = createSignalMessage(BROADCAST_CHANNEL, 'pong')

      await expect(handler.handleSignal(mockClient, message)).resolves.not.toThrow()
    })

    it('should throw MessageError for unknown signal type', async () => {
      const message = createSignalMessage('test', 'unknown' as any)

      await expect(handler.handleSignal(mockClient, message)).rejects.toThrow(MessageError)
    })
  })

  describe('handleSubscribe', () => {
    it('should throw error for reserved channel when not allowed', async () => {
      const message = createSignalMessage('__private__', 'subscribe')

      await expect(handler.handleSubscribe(mockClient, message)).rejects.toThrow(ChannelError)
    })

    it('should throw error for broadcast channel', async () => {
      const message = createSignalMessage(BROADCAST_CHANNEL, 'subscribe')

      await expect(handler.handleSubscribe(mockClient, message)).rejects.toThrow(ChannelError)
    })

    it('should execute subscribe middleware', async () => {
      const message = createSignalMessage('test', 'subscribe')
      const executeSpy = vi.spyOn(middleware, 'executeSubscribe')

      await handler.handleSubscribe(mockClient, message)

      expect(executeSpy).toHaveBeenCalledWith(mockClient, 'test')
    })

    it('should throw error when channel does not exist', async () => {
      const message = createSignalMessage('nonexistent', 'subscribe')

      await expect(handler.handleSubscribe(mockClient, message)).rejects.toThrow(ChannelError)
    })

    it('should subscribe client to channel', async () => {
      const message = createSignalMessage('test', 'subscribe')
      const subscribeSpy = vi.spyOn(registry, 'subscribe')

      await handler.handleSubscribe(mockClient, message)

      expect(subscribeSpy).toHaveBeenCalledWith(mockClient.id, 'test')
    })

    it('should emit subscribe event when emitSubscribeEvent is true', async () => {
      const message = createSignalMessage('test', 'subscribe')
      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleSubscribe(mockClient, message)

      expect(emitSpy).toHaveBeenCalledWith('subscribe', mockClient, 'test')
    })

    it('should send subscribed acknowledgment when sendAcknowledgments is true', async () => {
      const message = createSignalMessage('test', 'subscribe', undefined, 'msg-1')

      await handler.handleSubscribe(mockClient, message)

      expect(mockSendToClient).toHaveBeenCalledWith(
        mockClient.id,
        expect.objectContaining({
          type: 'signal',
          channel: 'test',
          signal: 'subscribed',
          id: 'msg-1',
        }),
      )
    })

    it('should not send acknowledgment when sendAcknowledgments is false', async () => {
      handler = new SignalHandler({
        registry,
        middleware,
        emitter,
        channels,
        sendToClient: mockSendToClient,
        options: { sendAcknowledgments: false },
      })

      const message = createSignalMessage('test', 'subscribe')
      await handler.handleSubscribe(mockClient, message)

      expect(mockSendToClient).not.toHaveBeenCalled()
    })
  })

  describe('handleUnsubscribe', () => {
    beforeEach(() => {
      // Subscribe client first
      vi.spyOn(registry, 'isSubscribed').mockReturnValue(true)
    })

    it('should execute unsubscribe middleware', async () => {
      const message = createSignalMessage('test', 'unsubscribe')
      const executeSpy = vi.spyOn(middleware, 'executeUnsubscribe')

      await handler.handleUnsubscribe(mockClient, message)

      expect(executeSpy).toHaveBeenCalledWith(mockClient, 'test')
    })

    it('should throw error when client is not subscribed', async () => {
      vi.spyOn(registry, 'isSubscribed').mockReturnValue(false)
      const message = createSignalMessage('test', 'unsubscribe')

      await expect(handler.handleUnsubscribe(mockClient, message)).rejects.toThrow(ChannelError)
    })

    it('should unsubscribe client from channel', async () => {
      const message = createSignalMessage('test', 'unsubscribe')
      const unsubscribeSpy = vi.spyOn(registry, 'unsubscribe')

      await handler.handleUnsubscribe(mockClient, message)

      expect(unsubscribeSpy).toHaveBeenCalledWith(mockClient.id, 'test')
    })

    it('should emit unsubscribe event when emitUnsubscribeEvent is true', async () => {
      const message = createSignalMessage('test', 'unsubscribe')
      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleUnsubscribe(mockClient, message)

      expect(emitSpy).toHaveBeenCalledWith('unsubscribe', mockClient, 'test')
    })

    it('should send unsubscribed acknowledgment', async () => {
      const message = createSignalMessage('test', 'unsubscribe', undefined, 'msg-1')

      await handler.handleUnsubscribe(mockClient, message)

      expect(mockSendToClient).toHaveBeenCalledWith(
        mockClient.id,
        expect.objectContaining({
          type: 'signal',
          channel: 'test',
          signal: 'unsubscribed',
          id: 'msg-1',
        }),
      )
    })
  })

  describe('handlePing', () => {
    it('should send pong when autoRespondToPing is true', async () => {
      const message = createSignalMessage(BROADCAST_CHANNEL, 'ping', undefined, 'ping-1')

      await handler.handlePing(mockClient, message)

      expect(mockSendToClient).toHaveBeenCalledWith(
        mockClient.id,
        expect.objectContaining({
          type: 'signal',
          signal: 'pong',
          id: 'ping-1',
        }),
      )
    })

    it('should not send pong when autoRespondToPing is false', async () => {
      handler = new SignalHandler({
        registry,
        middleware,
        emitter,
        channels,
        sendToClient: mockSendToClient,
        options: { autoRespondToPing: false },
      })

      const message = createSignalMessage(BROADCAST_CHANNEL, 'ping')
      await handler.handlePing(mockClient, message)

      expect(mockSendToClient).not.toHaveBeenCalled()
    })
  })

  describe('handlePong', () => {
    it('should handle pong without error', async () => {
      const message = createSignalMessage(BROADCAST_CHANNEL, 'pong')

      await expect(handler.handlePong(mockClient, message)).resolves.not.toThrow()
    })

    it('should be a no-op (client is still alive)', async () => {
      const message = createSignalMessage(BROADCAST_CHANNEL, 'pong')

      await handler.handlePong(mockClient, message)

      // Should not send any response
      expect(mockSendToClient).not.toHaveBeenCalled()
    })
  })

  describe('getOptions', () => {
    it('should return default options', () => {
      const options = handler.getOptions()

      expect(options.emitSubscribeEvent).toBe(true)
      expect(options.emitUnsubscribeEvent).toBe(true)
      expect(options.allowReservedChannels).toBe(false)
      expect(options.sendAcknowledgments).toBe(true)
      expect(options.autoRespondToPing).toBe(true)
    })

    it('should return custom options', () => {
      handler = new SignalHandler({
        registry,
        middleware,
        emitter,
        channels,
        sendToClient: mockSendToClient,
        options: {
          emitSubscribeEvent: false,
          emitUnsubscribeEvent: false,
          allowReservedChannels: true,
          sendAcknowledgments: false,
          autoRespondToPing: false,
        },
      })

      const options = handler.getOptions()

      expect(options.emitSubscribeEvent).toBe(false)
      expect(options.emitUnsubscribeEvent).toBe(false)
      expect(options.allowReservedChannels).toBe(true)
      expect(options.sendAcknowledgments).toBe(false)
      expect(options.autoRespondToPing).toBe(false)
    })
  })
})
