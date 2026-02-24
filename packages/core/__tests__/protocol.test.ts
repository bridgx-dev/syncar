/**
 * Protocol tests
 */

import { describe, it, expect } from 'vitest'
import {
  MessageType,
  SignalType,
  ErrorCode,
  generateMessageId,
  createDataMessage,
  createSignalMessage,
  createErrorMessage,
  isDataMessage,
  isSignalMessage,
  isErrorMessage,
  isAckMessage,
  type Message,
  type DataMessage,
} from '../protocol.js'

describe('Protocol', () => {
  describe('generateMessageId', () => {
    it('should generate unique message IDs', () => {
      const id1 = generateMessageId()
      const id2 = generateMessageId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/)
    })
  })

  describe('createDataMessage', () => {
    it('should create a valid data message', () => {
      const message = createDataMessage('chat', { text: 'hello' })

      expect(message.type).toBe(MessageType.DATA)
      expect(message.channel).toBe('chat')
      expect(message.data).toEqual({ text: 'hello' })
      expect(message.timestamp).toBeGreaterThan(0)
      expect(message.id).toMatch(/^msg_\d+_[a-z0-9]+$/)
    })

    it('should accept custom message ID', () => {
      const customId = 'custom-msg-123'
      const message = createDataMessage('chat', { text: 'hello' }, customId)

      expect(message.id).toBe(customId)
    })
  })

  describe('createSignalMessage', () => {
    it('should create a valid signal message', () => {
      const message = createSignalMessage('chat', SignalType.SUBSCRIBE)

      expect(message.type).toBe(MessageType.SIGNAL)
      expect(message.channel).toBe('chat')
      expect(message.signal).toBe(SignalType.SUBSCRIBE)
      expect(message.timestamp).toBeGreaterThan(0)
    })

    it('should include optional data', () => {
      const message = createSignalMessage('chat', SignalType.SUBSCRIBE, {
        token: 'abc',
      })

      expect(message.data).toEqual({ token: 'abc' })
    })
  })

  describe('createErrorMessage', () => {
    it('should create a valid error message', () => {
      const message = createErrorMessage(
        'Something went wrong',
        ErrorCode.CHANNEL_NOT_FOUND,
      )

      expect(message.type).toBe(MessageType.ERROR)
      expect(message.data.message).toBe('Something went wrong')
      expect(message.data.code).toBe(ErrorCode.CHANNEL_NOT_FOUND)
    })

    it('should include optional channel', () => {
      const message = createErrorMessage(
        'Error',
        ErrorCode.INVALID_MESSAGE_TYPE,
        'chat',
      )

      expect(message.channel).toBe('chat')
    })
  })

  describe('Type Guards', () => {
    it('isDataMessage should correctly identify data messages', () => {
      const dataMessage: Message = createDataMessage('chat', { text: 'hello' })
      const signalMessage: Message = createSignalMessage(
        'chat',
        SignalType.PING,
      )

      expect(isDataMessage(dataMessage)).toBe(true)
      expect(isDataMessage(signalMessage)).toBe(false)
    })

    it('isSignalMessage should correctly identify signal messages', () => {
      const dataMessage: Message = createDataMessage('chat', { text: 'hello' })
      const signalMessage: Message = createSignalMessage(
        'chat',
        SignalType.PING,
      )

      expect(isSignalMessage(dataMessage)).toBe(false)
      expect(isSignalMessage(signalMessage)).toBe(true)
    })

    it('isErrorMessage should correctly identify error messages', () => {
      const dataMessage: Message = createDataMessage('chat', { text: 'hello' })
      const errorMessage: Message = createErrorMessage('Error')

      expect(isErrorMessage(dataMessage)).toBe(false)
      expect(isErrorMessage(errorMessage)).toBe(true)
    })

    it('isAckMessage should correctly identify ack messages', () => {
      const ackMessage: Message = {
        id: 'msg-1',
        type: MessageType.ACK,
        ackMessageId: 'msg-2',
        timestamp: Date.now(),
      }

      expect(isAckMessage(ackMessage)).toBe(true)
    })
  })

  describe('MessageType enum', () => {
    it('should have all required message types', () => {
      expect(MessageType.DATA).toBe('data')
      expect(MessageType.SIGNAL).toBe('signal')
      expect(MessageType.ERROR).toBe('error')
      expect(MessageType.ACK).toBe('ack')
    })
  })

  describe('SignalType enum', () => {
    it('should have all required signal types', () => {
      expect(SignalType.SUBSCRIBE).toBe('subscribe')
      expect(SignalType.UNSUBSCRIBE).toBe('unsubscribe')
      expect(SignalType.PING).toBe('ping')
      expect(SignalType.PONG).toBe('pong')
      expect(SignalType.SUBSCRIBED).toBe('subscribed')
      expect(SignalType.UNSUBSCRIBED).toBe('unsubscribed')
    })
  })

  describe('ErrorCode enum', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.INVALID_MESSAGE_TYPE).toBe('INVALID_MESSAGE_TYPE')
      expect(ErrorCode.MISSING_CHANNEL).toBe('MISSING_CHANNEL')
      expect(ErrorCode.CHANNEL_NOT_FOUND).toBe('CHANNEL_NOT_FOUND')
      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED')
    })
  })
})
