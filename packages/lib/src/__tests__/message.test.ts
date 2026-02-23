/**
 * Message utilities tests
 */

import { describe, it, expect } from 'vitest'
import {
  isDataMessage,
  isSignalMessage,
  isErrorMessage,
  isAckMessage,
  createDataMessage,
  createSignalMessage,
  createErrorMessage,
  createAckMessage,
} from '../message.js'
import { MessageType, SignalType, ErrorCode } from '@synnel/types'

describe('message', () => {
  describe('type guards', () => {
    const baseMessage = {
      id: 'test-id',
      timestamp: Date.now(),
    }

    it('isDataMessage correctly identifies data messages', () => {
      const dataMessage = {
        ...baseMessage,
        type: MessageType.DATA,
        channel: 'chat',
        data: { text: 'hello' },
      }

      expect(isDataMessage(dataMessage)).toBe(true)
      expect(isSignalMessage(dataMessage)).toBe(false)
      expect(isErrorMessage(dataMessage)).toBe(false)
      expect(isAckMessage(dataMessage)).toBe(false)
    })

    it('isSignalMessage correctly identifies signal messages', () => {
      const signalMessage = {
        ...baseMessage,
        type: MessageType.SIGNAL,
        channel: 'chat',
        signal: SignalType.SUBSCRIBE,
      }

      expect(isSignalMessage(signalMessage)).toBe(true)
      expect(isDataMessage(signalMessage)).toBe(false)
      expect(isErrorMessage(signalMessage)).toBe(false)
      expect(isAckMessage(signalMessage)).toBe(false)
    })

    it('isErrorMessage correctly identifies error messages', () => {
      const errorMessage = {
        ...baseMessage,
        type: MessageType.ERROR,
        channel: 'chat',
        data: { message: 'Error occurred' },
      }

      expect(isErrorMessage(errorMessage)).toBe(true)
      expect(isDataMessage(errorMessage)).toBe(false)
      expect(isSignalMessage(errorMessage)).toBe(false)
      expect(isAckMessage(errorMessage)).toBe(false)
    })

    it('isAckMessage correctly identifies ack messages', () => {
      const ackMessage = {
        ...baseMessage,
        type: MessageType.ACK,
        ackMessageId: 'original-id',
      }

      expect(isAckMessage(ackMessage)).toBe(true)
      expect(isDataMessage(ackMessage)).toBe(false)
      expect(isSignalMessage(ackMessage)).toBe(false)
      expect(isErrorMessage(ackMessage)).toBe(false)
    })
  })

  describe('createDataMessage', () => {
    it('creates a valid data message', () => {
      const message = createDataMessage('chat', { text: 'hello' })

      expect(message.type).toBe(MessageType.DATA)
      expect(message.channel).toBe('chat')
      expect(message.data).toEqual({ text: 'hello' })
      expect(message.id).toBeTruthy()
      expect(message.timestamp).toBeGreaterThan(0)
    })

    it('accepts custom message ID', () => {
      const customId = 'custom-id'
      const message = createDataMessage('chat', {}, customId)

      expect(message.id).toBe(customId)
    })
  })

  describe('createSignalMessage', () => {
    it('creates a valid signal message', () => {
      const message = createSignalMessage('chat', SignalType.SUBSCRIBE)

      expect(message.type).toBe(MessageType.SIGNAL)
      expect(message.channel).toBe('chat')
      expect(message.signal).toBe(SignalType.SUBSCRIBE)
      expect(message.id).toBeTruthy()
      expect(message.timestamp).toBeGreaterThan(0)
    })

    it('accepts data and custom message ID', () => {
      const customId = 'custom-id'
      const data = { userId: '123' }
      const message = createSignalMessage('chat', SignalType.SUBSCRIBE, data, customId)

      expect(message.id).toBe(customId)
      expect(message.data).toEqual(data)
    })
  })

  describe('createErrorMessage', () => {
    it('creates a valid error message', () => {
      const message = createErrorMessage('Something went wrong', ErrorCode.INVALID_MESSAGE_FORMAT)

      expect(message.type).toBe(MessageType.ERROR)
      expect(message.data.message).toBe('Something went wrong')
      expect(message.data.code).toBe(ErrorCode.INVALID_MESSAGE_FORMAT)
      expect(message.id).toBeTruthy()
      expect(message.timestamp).toBeGreaterThan(0)
    })

    it('accepts channel and custom message ID', () => {
      const customId = 'custom-id'
      const channel = 'chat'
      const message = createErrorMessage('Error', undefined, channel, customId)

      expect(message.id).toBe(customId)
      expect(message.channel).toBe(channel)
    })
  })

  describe('createAckMessage', () => {
    it('creates a valid ack message', () => {
      const originalId = 'original-message-id'
      const message = createAckMessage(originalId)

      expect(message.type).toBe(MessageType.ACK)
      expect(message.ackMessageId).toBe(originalId)
      expect(message.id).toBeTruthy()
      expect(message.timestamp).toBeGreaterThan(0)
    })

    it('accepts channel and custom message ID', () => {
      const customId = 'custom-id'
      const channel = 'chat'
      const message = createAckMessage('original-id', channel, customId)

      expect(message.id).toBe(customId)
      expect(message.channel).toBe(channel)
    })
  })
})
