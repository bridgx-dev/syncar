/**
 * Registry State Unit Tests
 * Tests for state types and utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createEmptyState,
  createChannel,
  deleteChannel,
  getChannelSubscriberCount,
  getTotalSubscriptionCount,
  isSubscribed,
  getChannelSubscribers,
  getClientChannels,
  type RegistryState,
} from '../../src/registry/state.js'
import type { ClientId, ChannelName } from '../../src/types/index.js'

// Helper to create mock client
function createMockClient(id: ClientId) {
  return {
    id,
    socket: {
      send: () => {},
      close: () => {},
    } as any,
    status: 'connected' as const,
    connectedAt: Date.now(),
  }
}

describe('RegistryState', () => {
  let state: RegistryState

  beforeEach(() => {
    state = createEmptyState()
  })

  describe('createEmptyState', () => {
    it('should create empty state with all maps initialized', () => {
      expect(state.clients).toBeInstanceOf(Map)
      expect(state.subscriptions).toBeInstanceOf(Map)
      expect(state.channels).toBeInstanceOf(Map)

      expect(state.clients.size).toBe(0)
      expect(state.subscriptions.size).toBe(0)
      expect(state.channels.size).toBe(0)
    })
  })

  describe('createChannel', () => {
    it('should create a channel with empty subscriber set', () => {
      createChannel(state, 'chat' as ChannelName)

      expect(state.channels.has('chat' as ChannelName)).toBe(true)
      expect(getChannelSubscriberCount(state, 'chat' as ChannelName)).toBe(0)
    })

    it('should not overwrite existing channel', () => {
      createChannel(state, 'chat' as ChannelName)

      // Simulate adding a subscriber
      const clientId = 'client-1' as ClientId
      state.channels.get('chat' as ChannelName)!.add(clientId)

      // Try to create again
      createChannel(state, 'chat' as ChannelName)

      // Original subscribers should still be there
      expect(state.channels.get('chat' as ChannelName)?.has(clientId)).toBe(true)
    })

    it('should allow multiple channels', () => {
      createChannel(state, 'chat' as ChannelName)
      createChannel(state, 'news' as ChannelName)
      createChannel(state, 'updates' as ChannelName)

      expect(state.channels.size).toBe(3)
      expect(state.channels.has('chat' as ChannelName)).toBe(true)
      expect(state.channels.has('news' as ChannelName)).toBe(true)
      expect(state.channels.has('updates' as ChannelName)).toBe(true)
    })
  })

  describe('deleteChannel', () => {
    it('should delete channel and return true', () => {
      createChannel(state, 'chat' as ChannelName)

      deleteChannel(state, 'chat' as ChannelName)

      expect(state.channels.has('chat' as ChannelName)).toBe(false)
    })

    it('should clean up subscriptions when deleting channel', () => {
      createChannel(state, 'chat' as ChannelName)
      createChannel(state, 'news' as ChannelName)

      // Add some subscriptions
      const subscribers = state.channels.get('chat' as ChannelName)!
      subscribers.add('client-1' as ClientId)
      subscribers.add('client-2' as ClientId)

      // Update subscriptions map
      state.subscriptions.set('client-1' as ClientId, new Set(['chat' as ChannelName]))
      state.subscriptions.set('client-2' as ClientId, new Set(['chat' as ChannelName]))

      // Delete channel
      deleteChannel(state, 'chat' as ChannelName)

      // Check subscriptions were cleaned up
      expect(state.subscriptions.get('client-1' as ClientId)?.has('chat' as ChannelName)).toBe(false)
      expect(state.subscriptions.get('client-2' as ClientId)?.has('chat' as ChannelName)).toBe(false)
    })

    it('should not error when deleting non-existent channel', () => {
      expect(() => {
        deleteChannel(state, 'nonexistent' as ChannelName)
      }).not.toThrow()
    })
  })

  describe('getChannelSubscriberCount', () => {
    it('should return 0 for non-existent channel', () => {
      expect(getChannelSubscriberCount(state, 'nonexistent' as ChannelName)).toBe(0)
    })

    it('should return correct subscriber count', () => {
      createChannel(state, 'chat' as ChannelName)

      expect(getChannelSubscriberCount(state, 'chat' as ChannelName)).toBe(0)

      const subscribers = state.channels.get('chat' as ChannelName)!
      subscribers.add('client-1' as ClientId)
      subscribers.add('client-2' as ClientId)

      expect(getChannelSubscriberCount(state, 'chat' as ChannelName)).toBe(2)
    })
  })

  describe('getTotalSubscriptionCount', () => {
    it('should return 0 for empty state', () => {
      expect(getTotalSubscriptionCount(state)).toBe(0)
    })

    it('should sum subscriptions across all channels', () => {
      createChannel(state, 'chat' as ChannelName)
      createChannel(state, 'news' as ChannelName)

      // chat: 2 subscribers
      state.channels.get('chat' as ChannelName)!.add('client-1' as ClientId)
      state.channels.get('chat' as ChannelName)!.add('client-2' as ClientId)

      // news: 1 subscriber
      state.channels.get('news' as ChannelName)!.add('client-1' as ClientId)

      expect(getTotalSubscriptionCount(state)).toBe(3)
    })
  })

  describe('isSubscribed', () => {
    it('should return false for non-existent channel', () => {
      expect(isSubscribed(state, 'client-1' as ClientId, 'nonexistent' as ChannelName)).toBe(false)
    })

    it('should return false for non-subscribed client', () => {
      createChannel(state, 'chat' as ChannelName)

      expect(isSubscribed(state, 'client-1' as ClientId, 'chat' as ChannelName)).toBe(false)
    })

    it('should return true for subscribed client', () => {
      createChannel(state, 'chat' as ChannelName)
      state.channels.get('chat' as ChannelName)!.add('client-1' as ClientId)

      expect(isSubscribed(state, 'client-1' as ClientId, 'chat' as ChannelName)).toBe(true)
    })
  })

  describe('getChannelSubscribers', () => {
    it('should return empty set for non-existent channel', () => {
      const subscribers = getChannelSubscribers(state, 'nonexistent' as ChannelName)

      expect(subscribers).toBeInstanceOf(Set)
      expect(subscribers.size).toBe(0)
    })

    it('should return copy of subscribers set', () => {
      createChannel(state, 'chat' as ChannelName)
      const subscribers = state.channels.get('chat' as ChannelName)!
      subscribers.add('client-1' as ClientId)
      subscribers.add('client-2' as ClientId)

      const result = getChannelSubscribers(state, 'chat' as ChannelName)

      expect(result.size).toBe(2)
      expect(result.has('client-1' as ClientId)).toBe(true)
      expect(result.has('client-2' as ClientId)).toBe(true)
    })
  })

  describe('getClientChannels', () => {
    it('should return empty set for client with no subscriptions', () => {
      const channels = getClientChannels(state, 'client-1' as ClientId)

      expect(channels).toBeInstanceOf(Set)
      expect(channels.size).toBe(0)
    })

    it('should return channels client is subscribed to', () => {
      createChannel(state, 'chat' as ChannelName)
      createChannel(state, 'news' as ChannelName)

      const subscriptions = state.subscriptions.get('client-1' as ClientId) ?? new Set()
      subscriptions.add('chat' as ChannelName)
      subscriptions.add('news' as ChannelName)
      state.subscriptions.set('client-1' as ClientId, subscriptions)

      const result = getClientChannels(state, 'client-1' as ClientId)

      expect(result.size).toBe(2)
      expect(result.has('chat' as ChannelName)).toBe(true)
      expect(result.has('news' as ChannelName)).toBe(true)
    })
  })

  describe('bidirectional index consistency', () => {
    it('should maintain consistency when adding subscriptions', () => {
      createChannel(state, 'chat' as ChannelName)

      const clientId = 'client-1' as ClientId
      const channelName = 'chat' as ChannelName

      // Add to channels (reverse index)
      state.channels.get(channelName)!.add(clientId)

      // Add to subscriptions (forward index)
      const subscriptions = state.subscriptions.get(clientId) ?? new Set()
      subscriptions.add(channelName)
      state.subscriptions.set(clientId, subscriptions)

      // Check consistency
      expect(isSubscribed(state, clientId, channelName)).toBe(true)
      expect(getChannelSubscribers(state, channelName).has(clientId)).toBe(true)
      expect(getClientChannels(state, clientId).has(channelName)).toBe(true)
    })

    it('should maintain consistency when removing subscriptions', () => {
      createChannel(state, 'chat' as ChannelName)

      const clientId = 'client-1' as ClientId
      const channelName = 'chat' as ChannelName

      // Set up subscription
      state.channels.get(channelName)!.add(clientId)
      const subscriptions = state.subscriptions.get(clientId) ?? new Set()
      subscriptions.add(channelName)
      state.subscriptions.set(clientId, subscriptions)

      // Verify initial state
      expect(isSubscribed(state, clientId, channelName)).toBe(true)

      // Remove from channels (reverse index)
      state.channels.get(channelName)!.delete(clientId)

      // Remove from subscriptions (forward index)
      state.subscriptions.get(clientId)?.delete(channelName)

      // Check consistency
      expect(isSubscribed(state, clientId, channelName)).toBe(false)
      expect(getChannelSubscribers(state, channelName).has(clientId)).toBe(false)
      expect(getClientChannels(state, clientId).has(channelName)).toBe(false)
    })
  })
})
