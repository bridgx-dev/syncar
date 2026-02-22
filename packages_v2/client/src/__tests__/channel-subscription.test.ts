/**
 * ChannelSubscription Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChannelSubscriptionImpl } from '../channel-subscription.js'
import type { DataMessage } from '@synnel/core-v2'
import { SignalType } from '@synnel/core-v2'
import type { SubscriptionCallbacks, SubscribeOptions } from '../types.js'

describe('ChannelSubscription', () => {
  let subscription: ChannelSubscriptionImpl
  let callbacks: SubscriptionCallbacks

  beforeEach(() => {
    callbacks = {
      onMessage: vi.fn(),
      onSubscribed: vi.fn(),
      onUnsubscribed: vi.fn(),
      onError: vi.fn(),
    }

    subscription = new ChannelSubscriptionImpl('test-channel', {
      callbacks,
      autoResubscribe: true,
    })
  })

  describe('constructor', () => {
    it('should initialize with unsubscribed state', () => {
      expect(subscription.state).toBe('unsubscribed')
      expect(subscription.channel).toBe('test-channel')
      expect(subscription.autoResubscribe).toBe(true)
    })

    it('should accept custom options', () => {
      const customSub = new ChannelSubscriptionImpl('custom', {
        autoResubscribe: false,
        data: { token: 'abc' },
      })

      expect(customSub.autoResubscribe).toBe(false)
    })
  })

  describe('subscribe', () => {
    it('should subscribe to the channel', async () => {
      let sentChannel: string | undefined
      let sentData: unknown

      subscription.sendSubscribe = async (channel, data) => {
        sentChannel = channel
        sentData = data
      }

      await subscription.subscribe()

      expect(subscription.state).toBe('subscribing')
      expect(sentChannel).toBe('test-channel')
    })

    it('should handle subscribe failure', async () => {
      subscription.sendSubscribe = async () => {
        throw new Error('Subscribe failed')
      }

      await expect(subscription.subscribe()).rejects.toThrow('Subscribe failed')
      expect(subscription.state).toBe('unsubscribed')
    })

    it('should update to subscribed when SUBSCRIBED signal received', async () => {
      subscription.sendSubscribe = async () => {}

      await subscription.subscribe()

      // Simulate receiving SUBSCRIBED signal
      subscription.handleSignal(SignalType.SUBSCRIBED)

      expect(subscription.state).toBe('subscribed')
      expect(callbacks.onSubscribed).toHaveBeenCalled()
    })

    it('should accept options when subscribing', async () => {
      subscription.sendSubscribe = async () => {}

      await subscription.subscribe({ data: { custom: 'data' } })

      expect(subscription.state).toBe('subscribing')
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe from the channel', async () => {
      let sentChannel: string | undefined

      subscription.sendUnsubscribe = async (channel) => {
        sentChannel = channel
      }

      // First subscribe
      subscription.sendSubscribe = async () => {}
      await subscription.subscribe()
      subscription.handleSignal(SignalType.SUBSCRIBED)

      // Then unsubscribe
      await subscription.unsubscribe()

      expect(subscription.state).toBe('unsubscribing')
      expect(sentChannel).toBe('test-channel')
    })

    it('should update to unsubscribed when UNSUBSCRIBED signal received', async () => {
      subscription.sendSubscribe = async () => {}
      subscription.sendUnsubscribe = async () => {}

      await subscription.subscribe()
      subscription.handleSignal(SignalType.SUBSCRIBED)

      await subscription.unsubscribe()
      subscription.handleSignal(SignalType.UNSUBSCRIBED)

      expect(subscription.state).toBe('unsubscribed')
      expect(callbacks.onUnsubscribed).toHaveBeenCalled()
    })

    it('should be idempotent when already unsubscribed', async () => {
      await subscription.unsubscribe()
      await subscription.unsubscribe()

      expect(subscription.state).toBe('unsubscribed')
    })
  })

  describe('handleMessage', () => {
    it('should handle messages for the subscribed channel', () => {
      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'test-channel',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      subscription.handleMessage(message)

      expect(callbacks.onMessage).toHaveBeenCalledWith(message)
    })

    it('should ignore messages for other channels', () => {
      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'other-channel',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      subscription.handleMessage(message)

      expect(callbacks.onMessage).not.toHaveBeenCalled()
    })

    it('should call all registered message handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      subscription.onMessage(handler1)
      subscription.onMessage(handler2)

      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'test-channel',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      subscription.handleMessage(message)

      expect(handler1).toHaveBeenCalledWith(message)
      expect(handler2).toHaveBeenCalledWith(message)
    })
  })

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler = vi.fn()
      const unsubscribe = subscription.onMessage(handler)

      const message: DataMessage = {
        id: 'msg-1',
        type: 'data',
        channel: 'test-channel',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      subscription.handleMessage(message)

      expect(handler).toHaveBeenCalledWith(message)

      // Unsubscribe and verify handler is no longer called
      unsubscribe()

      subscription.handleMessage(message)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleError', () => {
    it('should handle subscription error', () => {
      const error = new Error('Subscription failed')

      subscription.handleError(error)

      expect(callbacks.onError).toHaveBeenCalledWith(error)
      expect(subscription.state).toBe('unsubscribed')
    })
  })

  describe('reset', () => {
    it('should reset subscription state', () => {
      subscription.sendSubscribe = async () => {}
      subscription.sendUnsubscribe = async () => {}

      subscription.subscribe()
      subscription.handleSignal(SignalType.SUBSCRIBED)

      expect(subscription.state).toBe('subscribed')

      subscription.reset()

      expect(subscription.state).toBe('unsubscribed')
    })

    it('should clear subscribedAt timestamp', () => {
      subscription.sendSubscribe = async () => {}

      subscription.subscribe()
      subscription.handleSignal(SignalType.SUBSCRIBED)

      const infoBefore = subscription.getInfo()
      expect(infoBefore.subscribedAt).toBeDefined()

      subscription.reset()

      const infoAfter = subscription.getInfo()
      expect(infoAfter.subscribedAt).toBeUndefined()
    })
  })

  describe('getInfo', () => {
    it('should return subscription info', () => {
      subscription.sendSubscribe = async () => {}

      subscription.subscribe()
      subscription.handleSignal(SignalType.SUBSCRIBED)

      const info = subscription.getInfo()

      expect(info.channel).toBe('test-channel')
      expect(info.state).toBe('subscribed')
      expect(info.autoResubscribe).toBe(true)
      expect(info.subscribedAt).toBeDefined()
    })
  })

  describe('destroy', () => {
    it('should clear all handlers and references', () => {
      subscription.sendSubscribe = async () => {}
      subscription.sendUnsubscribe = async () => {}

      subscription.subscribe()
      subscription.handleSignal(SignalType.SUBSCRIBED)

      subscription.destroy()

      // Handlers should be cleared
      expect(subscription.sendSubscribe).toBeUndefined()
      expect(subscription.sendUnsubscribe).toBeUndefined()

      // getInfo should still work but state should be reset
      const info = subscription.getInfo()
      expect(info.channel).toBe('test-channel')
    })
  })
})
