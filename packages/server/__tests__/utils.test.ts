/**
 * Unit tests for utils.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateMessageId,
  generateClientId,
  isValidChannelName,
  isReservedChannelName,
  assertValidChannelName,
  isDataMessage,
  createDataMessage,
  createSignalMessage,
  createDefaultLogger,
  type LogLevel,
} from '../src/utils'
import { MessageType, SignalType } from '../src/types'

describe('utils', () => {
  describe('ID Generation', () => {
    describe('generateMessageId', () => {
      it('should generate unique message IDs', () => {
        const id1 = generateMessageId()
        const id2 = generateMessageId()
        expect(id1).not.toBe(id2)
      })

      it('should generate ID in correct format (timestamp-random)', () => {
        const id = generateMessageId()
        expect(id).toMatch(/^\d+-[a-z0-9]+$/)
      })

      it('should include timestamp in ID', () => {
        const before = Date.now()
        const id = generateMessageId()
        const after = Date.now()
        const timestamp = parseInt(id.split('-')[0])
        expect(timestamp).toBeGreaterThanOrEqual(before)
        expect(timestamp).toBeLessThanOrEqual(after)
      })

      it('should have random part of reasonable length', () => {
        const id = generateMessageId()
        const parts = id.split('-')
        expect(parts[1].length).toBeGreaterThan(0)
        expect(parts[1].length).toBeLessThan(12)
      })
    })

    describe('generateClientId', () => {
      it('should generate unique client IDs', () => {
        const id1 = generateClientId()
        const id2 = generateClientId()
        expect(id1).not.toBe(id2)
      })

      it('should generate ID in correct format (client-timestamp-random)', () => {
        const id = generateClientId()
        expect(id).toMatch(/^client-\d+-[a-z0-9]+$/)
      })

      it('should include timestamp in ID', () => {
        const before = Date.now()
        const id = generateClientId()
        const after = Date.now()
        const match = id.match(/^client-(\d+)-/)
        const timestamp = match ? parseInt(match[1]) : 0
        expect(timestamp).toBeGreaterThanOrEqual(before)
        expect(timestamp).toBeLessThanOrEqual(after)
      })
    })
  })

  describe('Channel Name Validation', () => {
    describe('isValidChannelName', () => {
      it('should accept valid channel names', () => {
        expect(isValidChannelName('chat')).toBe(true)
        expect(isValidChannelName('a')).toBe(true)
        expect(isValidChannelName('channel-123')).toBe(true)
        expect(isValidChannelName('my_channel')).toBe(true)
        expect(isValidChannelName('room'.repeat(32))).toBe(true) // 128 chars
      })

      it('should reject empty string', () => {
        expect(isValidChannelName('')).toBe(false)
      })

      it('should reject strings longer than 128 characters', () => {
        expect(isValidChannelName('a'.repeat(129))).toBe(false)
      })

      it('should accept reserved channel names (format-wise)', () => {
        expect(isValidChannelName('__broadcast__')).toBe(true)
        expect(isValidChannelName('__private__')).toBe(true)
      })

      it('should reject non-string values', () => {
        expect(isValidChannelName(null as unknown as '')).toBe(false)
        expect(isValidChannelName(undefined as unknown as '')).toBe(false)
        expect(isValidChannelName(123 as unknown as '')).toBe(false)
      })
    })

    describe('isReservedChannelName', () => {
      it('should identify reserved channel names', () => {
        expect(isReservedChannelName('__broadcast__')).toBe(true)
        expect(isReservedChannelName('__private__')).toBe(true)
        expect(isReservedChannelName('__system')).toBe(true)
        expect(isReservedChannelName('__')).toBe(true)
      })

      it('should return false for non-reserved names', () => {
        expect(isReservedChannelName('chat')).toBe(false)
        expect(isReservedChannelName('_private')).toBe(false)
        expect(isReservedChannelName('__a')).toBe(true) // Still reserved
      })

      it('should handle empty string', () => {
        expect(isReservedChannelName('')).toBe(false)
      })
    })

    describe('assertValidChannelName', () => {
      it('should not throw for valid channel names', () => {
        expect(() => assertValidChannelName('chat')).not.toThrow()
        expect(() => assertValidChannelName('room-123')).not.toThrow()
      })

      it('should throw for empty string', () => {
        expect(() => assertValidChannelName('')).toThrow('Invalid channel name')
      })

      it('should throw for too long names', () => {
        expect(() => assertValidChannelName('a'.repeat(129))).toThrow('Invalid channel name')
      })

      it('should throw for reserved channel names', () => {
        expect(() => assertValidChannelName('__broadcast__')).toThrow('Reserved channel name')
        expect(() => assertValidChannelName('__private__')).toThrow('Reserved channel name')
      })
    })
  })

  describe('Message Utilities', () => {
    describe('isDataMessage', () => {
      it('should return true for data messages', () => {
        const dataMessage = {
          id: '1',
          type: MessageType.DATA,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }
        expect(isDataMessage(dataMessage)).toBe(true)
      })

      it('should return false for signal messages', () => {
        const signalMessage = {
          id: '1',
          type: MessageType.SIGNAL,
          channel: 'chat',
          signal: SignalType.SUBSCRIBE,
          timestamp: Date.now(),
        }
        expect(isDataMessage(signalMessage)).toBe(false)
      })

      it('should narrow type correctly', () => {
        const message = {
          id: '1',
          type: MessageType.DATA,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }

        if (isDataMessage(message)) {
          // TypeScript should know this is DataMessage
          expect(message.data).toBe('hello')
        }
      })
    })

    describe('createDataMessage', () => {
      it('should create a data message with all required fields', () => {
        const message = createDataMessage('chat', 'hello')
        expect(message).toMatchObject({
          type: MessageType.DATA,
          channel: 'chat',
          data: 'hello',
        })
        expect(message.id).toBeTruthy()
        expect(message.timestamp).toBeGreaterThan(0)
      })

      it('should use provided ID when given', () => {
        const customId = 'custom-id-123'
        const message = createDataMessage('chat', 'hello', customId)
        expect(message.id).toBe(customId)
      })

      it('should generate ID when not provided', () => {
        const message = createDataMessage('chat', 'hello')
        expect(message.id).toBeTruthy()
        expect(typeof message.id).toBe('string')
      })

      it('should handle complex data types', () => {
        const data = { text: 'hello', user: 'alice', count: 42 }
        const message = createDataMessage('chat', data)
        expect(message.data).toEqual(data)
      })
    })

    describe('createSignalMessage', () => {
      it('should create a signal message with all required fields', () => {
        const message = createSignalMessage('chat', SignalType.SUBSCRIBE)
        expect(message).toMatchObject({
          type: MessageType.SIGNAL,
          channel: 'chat',
          signal: SignalType.SUBSCRIBE,
        })
        expect(message.id).toBeTruthy()
        expect(message.timestamp).toBeGreaterThan(0)
      })

      it('should include data when provided', () => {
        const data = { token: 'abc123' }
        const message = createSignalMessage('chat', SignalType.SUBSCRIBE, data)
        expect(message.data).toEqual(data)
      })

      it('should not include data when not provided', () => {
        const message = createSignalMessage('chat', SignalType.PING)
        expect(message.data).toBeUndefined()
      })

      it('should use provided ID when given', () => {
        const customId = 'custom-signal-123'
        const message = createSignalMessage('chat', SignalType.PING, undefined, customId)
        expect(message.id).toBe(customId)
      })

      it('should handle all signal types', () => {
        const subscribeMsg = createSignalMessage('chat', SignalType.SUBSCRIBE)
        const unsubscribeMsg = createSignalMessage('chat', SignalType.UNSUBSCRIBE)
        const pingMsg = createSignalMessage('chat', SignalType.PING)
        const pongMsg = createSignalMessage('chat', SignalType.PONG)

        expect(subscribeMsg.signal).toBe(SignalType.SUBSCRIBE)
        expect(unsubscribeMsg.signal).toBe(SignalType.UNSUBSCRIBE)
        expect(pingMsg.signal).toBe(SignalType.PING)
        expect(pongMsg.signal).toBe(SignalType.PONG)
      })
    })
  })

  describe('Logging Utilities', () => {
    const consoleSpies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    describe('createDefaultLogger', () => {
      it('should create a logger with all methods', () => {
        const logger = createDefaultLogger()
        expect(logger).toHaveProperty('debug')
        expect(logger).toHaveProperty('info')
        expect(logger).toHaveProperty('warn')
        expect(logger).toHaveProperty('error')
      })

      it('should include default prefix in log messages', () => {
        const logger = createDefaultLogger()
        logger.info('test message')
        const loggedString = consoleSpies.log.mock.calls[0][0]
        expect(loggedString).toContain('[Synnel')
        expect(loggedString).toContain('test message')
      })

      it('should include custom prefix when provided', () => {
        const logger = createDefaultLogger('MyApp')
        logger.info('test message')
        const loggedString = consoleSpies.log.mock.calls[0][0]
        expect(loggedString).toContain('[MyApp')
        expect(loggedString).toContain('test message')
      })

      it('should include timestamp in log messages', () => {
        const logger = createDefaultLogger()
        logger.info('test')
        const loggedString = consoleSpies.log.mock.calls[0][0]
        // ISO timestamp format: 2026-03-08T07:35:32.415Z
        expect(loggedString).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      })

      it('should include log level in messages', () => {
        const logger = createDefaultLogger()

        logger.info('info message')
        let loggedString = consoleSpies.log.mock.calls[0][0]
        expect(loggedString).toContain('[INFO]')

        logger.warn('warn message')
        loggedString = consoleSpies.warn.mock.calls[0][0]
        expect(loggedString).toContain('[WARN]')

        logger.error('error message')
        loggedString = consoleSpies.error.mock.calls[0][0]
        expect(loggedString).toContain('[ERROR]')
      })

      it('should pass additional arguments to console', () => {
        const logger = createDefaultLogger()
        const obj = { key: 'value' }
        logger.info('message', obj, 'extra')
        const calls = consoleSpies.log.mock.calls
        // First arg is formatted string, rest are additional args
        expect(calls[0][0]).toContain('[Synnel')
        expect(calls[0][0]).toContain('message')
        expect(calls[0][1]).toBe(obj)
        expect(calls[0][2]).toBe('extra')
      })

      it('should disable debug logs by default', () => {
        const logger = createDefaultLogger()
        logger.debug('debug message')
        expect(consoleSpies.log).not.toHaveBeenCalled()
      })

      it('should enable debug logs when configured', () => {
        const logger = createDefaultLogger('Synnel', { debug: true })
        logger.debug('debug message')
        const loggedString = consoleSpies.log.mock.calls[0][0]
        expect(loggedString).toContain('[DEBUG]')
        expect(loggedString).toContain('debug message')
      })

      it('should allow selective log level enabling', () => {
        const logger = createDefaultLogger('Synnel', {
          debug: false,
          info: true,
          warn: false,
          error: true,
        })

        logger.debug('debug')
        logger.info('info')
        logger.warn('warn')
        logger.error('error')

        expect(consoleSpies.log).toHaveBeenCalledTimes(1) // Only info
        expect(consoleSpies.warn).not.toHaveBeenCalled()
        expect(consoleSpies.error).toHaveBeenCalledTimes(1)
      })

      it('should use correct console methods', () => {
        const logger = createDefaultLogger('Test', { debug: true })

        logger.debug('debug')
        expect(consoleSpies.log).toHaveBeenCalled()

        logger.info('info')
        expect(consoleSpies.log).toHaveBeenCalled()

        logger.warn('warn')
        expect(consoleSpies.warn).toHaveBeenCalled()

        logger.error('error')
        expect(consoleSpies.error).toHaveBeenCalled()
      })
    })
  })
})
