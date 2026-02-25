/**
 * MessageHandler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageHandler } from '../src/handlers/index.js'
import { ClientRegistry } from '../src/registry/index.js'
import { MiddlewareManager } from '../src/middleware/index.js'
import { EventEmitter } from '../src/emitter/index.js'
import { MulticastTransport } from '../src/channel/index.js'
import type { IServerClient } from '../src/types/index.js'
import { createDataMessage } from '@synnel/lib'
import type { DataMessage } from '@synnel/types'
import { ChannelError, MessageError } from '../src/errors/index.js'

// Mock IServerClient
function createMockClient(id: string): IServerClient {
  return {
    id,
    status: 'connected',
    connectedAt: Date.now(),
    metadata: {},
    send: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    isSubscribed: vi.fn(() => false),
    getSubscriptions: vi.fn(() => []),
    getConnection: vi.fn(),
    disconnect: vi.fn(),
  }
}

describe('MessageHandler', () => {
  let handler: MessageHandler
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

    // Create a test channel
    const testChannel = new MulticastTransport<string>('test', new Map())
    channels.set('test', testChannel)

    handler = new MessageHandler({
      registry,
      middleware,
      emitter,
      channels,
    })
  })

  describe('handleMessage', () => {
    it('should validate message is a DataMessage', async () => {
      const invalidMessage = { type: 'signal' } as any

      await expect(
        handler.handleMessage(mockClient, invalidMessage),
      ).rejects.toThrow(MessageError)
    })

    it('should throw ChannelError when requireChannel is true and channel not found', async () => {
      const message = createDataMessage('nonexistent', 'test data')

      await expect(handler.handleMessage(mockClient, message)).rejects.toThrow(
        ChannelError,
      )
    })

    it('should not throw when channel exists', async () => {
      const message = createDataMessage('test', 'test data')

      await expect(
        handler.handleMessage(mockClient, message),
      ).resolves.not.toThrow()
    })

    it('should execute message middleware when executeMiddleware is true', async () => {
      const message = createDataMessage('test', 'test data')
      const executeSpy = vi.spyOn(middleware, 'executeMessage')

      await handler.handleMessage(mockClient, message)

      expect(executeSpy).toHaveBeenCalledWith(mockClient, message)
    })

    it('should call channel.handleMessage() to trigger handlers', async () => {
      const message = createDataMessage('test', 'test data')
      const channel = channels.get('test')
      const handleSpy = vi.spyOn(channel as any, 'handleMessage')

      await handler.handleMessage(mockClient, message)

      expect(handleSpy).toHaveBeenCalledWith(message.data, mockClient, message)
    })

    it('should emit message event when emitMessageEvent is true', async () => {
      const message = createDataMessage('test', 'test data')
      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleMessage(mockClient, message)

      expect(emitSpy).toHaveBeenCalledWith('message', mockClient, message)
    })

    it('should not emit message event when emitMessageEvent is false', async () => {
      handler = new MessageHandler({
        registry,
        middleware,
        emitter,
        channels,
        options: { emitMessageEvent: false },
      })

      const message = createDataMessage('test', 'test data')
      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleMessage(mockClient, message)

      expect(emitSpy).not.toHaveBeenCalledWith(
        'message',
        expect.anything(),
        expect.anything(),
      )
    })

    it('should handle channel.handleError gracefully', async () => {
      const message = createDataMessage('test', 'test data')
      const channel = channels.get('test')
      vi.spyOn(channel as any, 'handleMessage').mockRejectedValue(
        new Error('Handler error'),
      )

      await expect(
        handler.handleMessage(mockClient, message),
      ).resolves.not.toThrow()
    })

    it('should allow messages when requireChannel is false', async () => {
      handler = new MessageHandler({
        registry,
        middleware,
        emitter,
        channels,
        options: { requireChannel: false },
      })

      const message = createDataMessage('nonexistent', 'test data')

      await expect(
        handler.handleMessage(mockClient, message),
      ).resolves.not.toThrow()
    })
  })

  describe('canProcessMessage', () => {
    it('should return false for non-DataMessage', () => {
      const invalidMessage = { type: 'signal' } as any

      expect(handler.canProcessMessage(invalidMessage)).toBe(false)
    })

    it('should return false when channel does not exist and requireChannel is true', () => {
      const message = createDataMessage('nonexistent', 'test data')

      expect(handler.canProcessMessage(message)).toBe(false)
    })

    it('should return true when channel exists and is DataMessage', () => {
      const message = createDataMessage('test', 'test data')

      expect(handler.canProcessMessage(message)).toBe(true)
    })

    it('should return true for any DataMessage when requireChannel is false', () => {
      handler = new MessageHandler({
        registry,
        middleware,
        emitter,
        channels,
        options: { requireChannel: false },
      })

      const message = createDataMessage('nonexistent', 'test data')

      expect(handler.canProcessMessage(message)).toBe(true)
    })
  })

  describe('getChannelForMessage', () => {
    it('should return the channel for a valid message', () => {
      const message = createDataMessage('test', 'test data')

      const channel = handler.getChannelForMessage(message)

      expect(channel).toBeDefined()
      expect(channel?.name).toBe('test')
    })

    it('should return undefined for non-existent channel', () => {
      const message = createDataMessage('nonexistent', 'test data')

      const channel = handler.getChannelForMessage(message)

      expect(channel).toBeUndefined()
    })
  })

  describe('getOptions', () => {
    it('should return default options', () => {
      const options = handler.getOptions()

      expect(options.emitMessageEvent).toBe(true)
      expect(options.requireChannel).toBe(true)
      expect(options.executeMiddleware).toBe(true)
    })

    it('should return custom options', () => {
      handler = new MessageHandler({
        registry,
        middleware,
        emitter,
        channels,
        options: {
          emitMessageEvent: false,
          requireChannel: false,
          executeMiddleware: false,
        },
      })

      const options = handler.getOptions()

      expect(options.emitMessageEvent).toBe(false)
      expect(options.requireChannel).toBe(false)
      expect(options.executeMiddleware).toBe(false)
    })
  })
})
