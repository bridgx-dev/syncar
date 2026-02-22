/**
 * Channel tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Channel, type ChannelOptions } from '../channel.js'

describe('Channel', () => {
  let channel: Channel

  beforeEach(() => {
    channel = new Channel('test-channel')
  })

  afterEach(() => {
    channel.clear()
  })

  describe('constructor', () => {
    it('should create a channel with a name', () => {
      expect(channel.name).toBe('test-channel')
    })

    it('should initialize with no subscribers', () => {
      expect(channel.getSubscriberCount()).toBe(0)
      expect(channel.isEmpty()).toBe(true)
    })

    it('should accept custom options', () => {
      const channelWithOptions = new Channel('limited', { maxSubscribers: 2 })
      expect(channelWithOptions.options.maxSubscribers).toBe(2)
    })

    it('should create reserved channel with static method', () => {
      const reserved = Channel.createReserved('__system__')
      expect(reserved.isReserved()).toBe(true)
      expect(reserved.name).toBe('__system__')
    })

    it('should throw for non-reserved name in createReserved', () => {
      expect(() => Channel.createReserved('normal')).toThrow()
    })
  })

  describe('subscribe', () => {
    it('should add a subscriber', () => {
      const result = channel.subscribe('client-1')
      expect(result).toBe(true)
      expect(channel.hasSubscriber('client-1')).toBe(true)
      expect(channel.getSubscriberCount()).toBe(1)
    })

    it('should not add duplicate subscribers', () => {
      channel.subscribe('client-1')
      const result = channel.subscribe('client-1')
      expect(result).toBe(false)
      expect(channel.getSubscriberCount()).toBe(1)
    })

    it('should enforce max subscribers limit', () => {
      const limitedChannel = new Channel('limited', { maxSubscribers: 2 })
      limitedChannel.subscribe('client-1')
      limitedChannel.subscribe('client-2')

      const result = limitedChannel.subscribe('client-3')
      expect(result).toBe(false)
      expect(limitedChannel.getSubscriberCount()).toBe(2)
    })

    it('should return subscribers as a Set', () => {
      channel.subscribe('client-1')
      channel.subscribe('client-2')

      const subscribers = channel.getSubscribers()
      expect(subscribers).toBeInstanceOf(Set)
      expect(subscribers.size).toBe(2)
      expect(subscribers.has('client-1')).toBe(true)
    })
  })

  describe('unsubscribe', () => {
    it('should remove a subscriber', () => {
      channel.subscribe('client-1')
      const result = channel.unsubscribe('client-1')

      expect(result).toBe(true)
      expect(channel.hasSubscriber('client-1')).toBe(false)
      expect(channel.isEmpty()).toBe(true)
    })

    it('should return false for non-existent subscriber', () => {
      const result = channel.unsubscribe('client-1')
      expect(result).toBe(false)
    })

    it('should only remove the specified subscriber', () => {
      channel.subscribe('client-1')
      channel.subscribe('client-2')
      channel.unsubscribe('client-1')

      expect(channel.hasSubscriber('client-1')).toBe(false)
      expect(channel.hasSubscriber('client-2')).toBe(true)
    })
  })

  describe('getState', () => {
    it('should return channel state', () => {
      const state = channel.getState()

      expect(state.name).toBe('test-channel')
      expect(state.subscriberCount).toBe(0)
      expect(state.createdAt).toBeGreaterThan(0)
    })

    it('should reflect subscriber count', () => {
      channel.subscribe('client-1')
      channel.subscribe('client-2')

      const state = channel.getState()
      expect(state.subscriberCount).toBe(2)
    })
  })

  describe('isFull', () => {
    it('should return false when no limit set', () => {
      expect(channel.isFull()).toBe(false)

      for (let i = 0; i < 1000; i++) {
        channel.subscribe(`client-${i}`)
      }

      expect(channel.isFull()).toBe(false)
    })

    it('should return true when limit reached', () => {
      const limitedChannel = new Channel('limited', { maxSubscribers: 2 })
      limitedChannel.subscribe('client-1')
      limitedChannel.subscribe('client-2')

      expect(limitedChannel.isFull()).toBe(true)
    })
  })

  describe('message history', () => {
    it('should not store history when disabled', () => {
      const message = {
        id: 'msg-1',
        type: 'data' as const,
        channel: 'test',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      channel['addToHistory'](message)
      expect(channel.getHistory()).toHaveLength(0)
    })

    it('should store history when enabled', () => {
      const historyChannel = new Channel('history', { historySize: 5 })

      const message = {
        id: 'msg-1',
        type: 'data' as const,
        channel: 'history',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      historyChannel['addToHistory'](message)
      expect(historyChannel.getHistory()).toHaveLength(1)
    })

    it('should limit history size', () => {
      const historyChannel = new Channel('history', { historySize: 2 })

      for (let i = 0; i < 5; i++) {
        const message = {
          id: `msg-${i}`,
          type: 'data' as const,
          channel: 'history',
          data: { index: i },
          timestamp: Date.now(),
        }
        historyChannel['addToHistory'](message)
      }

      expect(historyChannel.getHistory()).toHaveLength(2)
      expect(historyChannel.getHistory()[0].data.index).toBe(3)
      expect(historyChannel.getHistory()[1].data.index).toBe(4)
    })

    it('should clear history', () => {
      const historyChannel = new Channel('history', { historySize: 5 })

      const message = {
        id: 'msg-1',
        type: 'data' as const,
        channel: 'history',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      historyChannel['addToHistory'](message)
      historyChannel.clearHistory()

      expect(historyChannel.getHistory()).toHaveLength(0)
    })
  })

  describe('clear', () => {
    it('should remove all subscribers', () => {
      channel.subscribe('client-1')
      channel.subscribe('client-2')
      channel.clear()

      expect(channel.getSubscriberCount()).toBe(0)
      expect(channel.isEmpty()).toBe(true)
    })
  })

  describe('static validation methods', () => {
    it('should validate channel names', () => {
      expect(Channel.isValidChannelName('valid')).toBe(true)
      expect(Channel.isValidChannelName('test-channel-123')).toBe(true)
      expect(Channel.isValidChannelName('')).toBe(false)
      expect(Channel.isValidChannelName('a'.repeat(129))).toBe(false)
    })

    it('should identify reserved names', () => {
      expect(Channel.isReservedName('__system__')).toBe(true)
      expect(Channel.isReservedName('__broadcast')).toBe(true)
      expect(Channel.isReservedName('normal')).toBe(false)
      expect(Channel.isReservedName('_private')).toBe(false)
    })
  })
})
