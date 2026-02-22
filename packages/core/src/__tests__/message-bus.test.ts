/**
 * MessageBus tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageBus } from '../message-bus.js'
import { createDataMessage, MessageType } from '../protocol.js'

describe('MessageBus', () => {
  let bus: MessageBus

  beforeEach(() => {
    bus = new MessageBus()
  })

  afterEach(() => {
    bus.clear()
  })

  describe('constructor', () => {
    it('should initialize with no channels', () => {
      expect(bus.getChannelNames()).toHaveLength(0)
      expect(bus.getStats().totalChannels).toBe(0)
    })

    it('should accept custom options', () => {
      const customBus = new MessageBus({
        autoCreateChannels: true,
        autoDeleteEmptyChannels: true,
        emptyChannelGracePeriod: 1000,
      })

      expect(customBus.options.autoCreateChannels).toBe(true)
      expect(customBus.options.autoDeleteEmptyChannels).toBe(true)
      expect(customBus.options.emptyChannelGracePeriod).toBe(1000)
    })
  })

  describe('createChannel', () => {
    it('should create a new channel', () => {
      const channel = bus.createChannel('test')

      expect(channel).toBeDefined()
      expect(channel?.name).toBe('test')
      expect(bus.hasChannel('test')).toBe(true)
    })

    it('should not create duplicate channels', () => {
      bus.createChannel('test')
      const duplicate = bus.createChannel('test')

      expect(duplicate).toBeUndefined()
      expect(bus.getChannelNames()).toHaveLength(1)
    })

    it('should throw for invalid channel names', () => {
      expect(() => bus.createChannel('')).toThrow()
    })
  })

  describe('getChannel', () => {
    it('should return existing channel', () => {
      bus.createChannel('test')
      const channel = bus.getChannel('test')

      expect(channel).toBeDefined()
      expect(channel?.name).toBe('test')
    })

    it('should return undefined for non-existent channel', () => {
      const channel = bus.getChannel('nonexistent')
      expect(channel).toBeUndefined()
    })
  })

  describe('getOrCreateChannel', () => {
    it('should return existing channel', () => {
      bus.createChannel('test')
      const channel = bus.getOrCreateChannel('test')

      expect(channel.name).toBe('test')
      expect(bus.getChannelNames()).toHaveLength(1)
    })

    it('should create new channel when autoCreateChannels is true', () => {
      const autoBus = new MessageBus({ autoCreateChannels: true })
      const channel = autoBus.getOrCreateChannel('new')

      expect(channel.name).toBe('new')
      expect(autoBus.hasChannel('new')).toBe(true)
    })

    it('should throw when channel not found and autoCreateChannels is false', () => {
      expect(() => bus.getOrCreateChannel('new')).toThrow()
    })
  })

  describe('subscribe', () => {
    it('should subscribe to a channel', () => {
      bus.createChannel('test')
      const result = bus.subscribe('test', 'client-1')

      expect(result).toBe(true)
      expect(bus.getChannel('test')?.hasSubscriber('client-1')).toBe(true)
    })

    it('should create channel if autoCreateChannels is true', () => {
      const autoBus = new MessageBus({ autoCreateChannels: true })
      const result = autoBus.subscribe('new', 'client-1')

      expect(result).toBe(true)
      expect(autoBus.hasChannel('new')).toBe(true)
    })

    it('should throw when channel not found', () => {
      expect(() => bus.subscribe('nonexistent', 'client-1')).toThrow()
    })
  })

  describe('unsubscribe', () => {
    beforeEach(() => {
      bus.createChannel('test')
      bus.subscribe('test', 'client-1')
      bus.subscribe('test', 'client-2')
    })

    it('should unsubscribe from a channel', () => {
      const result = bus.unsubscribe('test', 'client-1')

      expect(result).toBe(true)
      expect(bus.getChannel('test')?.hasSubscriber('client-1')).toBe(false)
      expect(bus.getChannel('test')?.getSubscriberCount()).toBe(1)
    })

    it('should return false for non-existent subscriber', () => {
      const result = bus.unsubscribe('test', 'client-999')
      expect(result).toBe(false)
    })

    it('should return false for non-existent channel', () => {
      const result = bus.unsubscribe('nonexistent', 'client-1')
      expect(result).toBe(false)
    })
  })

  describe('unsubscribeAll', () => {
    it('should unsubscribe from all channels', () => {
      bus.createChannel('channel1')
      bus.createChannel('channel2')
      bus.subscribe('channel1', 'client-1')
      bus.subscribe('channel2', 'client-1')

      bus.unsubscribeAll('client-1')

      expect(bus.getChannel('channel1')?.hasSubscriber('client-1')).toBe(false)
      expect(bus.getChannel('channel2')?.hasSubscriber('client-1')).toBe(false)
    })
  })

  describe('getSubscribedChannels', () => {
    it('should return channels a subscriber is subscribed to', () => {
      bus.createChannel('channel1')
      bus.createChannel('channel2')
      bus.createChannel('channel3')

      bus.subscribe('channel1', 'client-1')
      bus.subscribe('channel2', 'client-1')
      bus.subscribe('channel3', 'client-2')

      const channels = bus.getSubscribedChannels('client-1')

      expect(channels).toEqual(['channel1', 'channel2'])
    })

    it('should return empty array for subscriber with no subscriptions', () => {
      const channels = bus.getSubscribedChannels('client-1')
      expect(channels).toEqual([])
    })
  })

  describe('publish', () => {
    beforeEach(() => {
      bus.createChannel('test')
      bus.subscribe('test', 'client-1')
      bus.subscribe('test', 'client-2')
      bus.subscribe('test', 'client-3')
    })

    it('should return number of subscribers message was sent to', () => {
      const message = createDataMessage('test', { text: 'hello' })
      const count = bus.publish('test', message)

      expect(count).toBe(3)
    })

    it('should exclude sender when specified', () => {
      const message = createDataMessage('test', { text: 'hello' })
      const count = bus.publish('test', message, 'client-1')

      expect(count).toBe(2) // Only client-2 and client-3
    })

    it('should return 0 for non-existent channel', () => {
      const message = createDataMessage('nonexistent', { text: 'hello' })
      const count = bus.publish('nonexistent', message)

      expect(count).toBe(0)
    })

    it('should notify global handlers', () => {
      const handler = vi.fn()
      bus.onMessage(handler)

      const message = createDataMessage('test', { text: 'hello' })
      bus.publish('test', message)

      expect(handler).toHaveBeenCalledWith(message, undefined)
    })
  })

  describe('broadcast', () => {
    beforeEach(() => {
      bus.createChannel('channel1')
      bus.createChannel('channel2')

      bus.subscribe('channel1', 'client-1')
      bus.subscribe('channel1', 'client-2')
      bus.subscribe('channel2', 'client-2')
      bus.subscribe('channel2', 'client-3')
    })

    it('should send message to all subscribers across all channels', () => {
      const message = createDataMessage('broadcast', { text: 'hello' })
      const count = bus.broadcast(message)

      expect(count).toBe(4) // All unique subscribers
    })

    it('should exclude sender from all channels', () => {
      const message = createDataMessage('broadcast', { text: 'hello' })
      const count = bus.broadcast(message, 'client-2')

      expect(count).toBe(2) // Only client-1 and client-3
    })
  })

  describe('onMessage', () => {
    it('should register global message handler', () => {
      const handler = vi.fn()
      bus.onMessage(handler)

      bus.createChannel('test')
      bus.subscribe('test', 'client-1')

      const message = createDataMessage('test', { text: 'hello' })
      bus.publish('test', message)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(message, undefined)
    })

    it('should return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = bus.onMessage(handler)

      bus.createChannel('test')
      bus.subscribe('test', 'client-1')

      const message = createDataMessage('test', { text: 'hello' })
      bus.publish('test', message)
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      const message2 = createDataMessage('test', { text: 'hello2' })
      bus.publish('test', message2)
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should support multiple handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.onMessage(handler1)
      bus.onMessage(handler2)

      bus.createChannel('test')
      bus.subscribe('test', 'client-1')

      const message = createDataMessage('test', { text: 'hello' })
      bus.publish('test', message)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteChannel', () => {
    it('should delete a channel', () => {
      bus.createChannel('test')
      expect(bus.hasChannel('test')).toBe(true)

      const result = bus.deleteChannel('test')

      expect(result).toBe(true)
      expect(bus.hasChannel('test')).toBe(false)
    })

    it('should return false for non-existent channel', () => {
      const result = bus.deleteChannel('nonexistent')
      expect(result).toBe(false)
    })

    it('should clear subscribers on delete', () => {
      bus.createChannel('test')
      bus.subscribe('test', 'client-1')
      bus.subscribe('test', 'client-2')

      bus.deleteChannel('test')

      expect(bus.hasChannel('test')).toBe(false)
    })
  })

  describe('auto-delete empty channels', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should schedule deletion when channel becomes empty', () => {
      const autoBus = new MessageBus({
        autoDeleteEmptyChannels: true,
        emptyChannelGracePeriod: 1000,
      })

      autoBus.createChannel('test')
      autoBus.subscribe('test', 'client-1')
      autoBus.unsubscribe('test', 'client-1')

      // Channel should still exist immediately (grace period)
      expect(autoBus.hasChannel('test')).toBe(true)

      // Fast forward past grace period
      vi.advanceTimersByTime(1001)

      // Now channel should be deleted
      expect(autoBus.hasChannel('test')).toBe(false)
    })

    it('should cancel deletion if subscriber rejoins', () => {
      const autoBus = new MessageBus({
        autoDeleteEmptyChannels: true,
        emptyChannelGracePeriod: 5000,
      })

      autoBus.createChannel('test')
      autoBus.subscribe('test', 'client-1')
      autoBus.unsubscribe('test', 'client-1')

      // Re-subscribe before grace period ends
      autoBus.subscribe('test', 'client-2')

      vi.advanceTimersByTime(6000)

      // Channel should still exist
      expect(autoBus.hasChannel('test')).toBe(true)
    })
  })

  describe('getStats', () => {
    it('should return statistics', () => {
      bus.createChannel('channel1')
      bus.createChannel('channel2')

      bus.subscribe('channel1', 'client-1')
      bus.subscribe('channel1', 'client-2')
      bus.subscribe('channel2', 'client-2')

      const stats = bus.getStats()

      expect(stats.totalChannels).toBe(2)
      expect(stats.totalSubscribers).toBe(3)
      expect(stats.channelStats).toHaveLength(2)

      expect(stats.channelStats[0]).toMatchObject({
        name: 'channel1',
        subscribers: 2,
        reserved: false,
      })

      expect(stats.channelStats[1]).toMatchObject({
        name: 'channel2',
        subscribers: 1,
        reserved: false,
      })
    })
  })

  describe('clear', () => {
    it('should clear all channels and handlers', () => {
      bus.createChannel('channel1')
      bus.createChannel('channel2')
      bus.subscribe('channel1', 'client-1')

      const handler = vi.fn()
      bus.onMessage(handler)

      bus.clear()

      expect(bus.getChannelNames()).toHaveLength(0)
      expect(bus.getStats().totalChannels).toBe(0)
    })
  })
})
