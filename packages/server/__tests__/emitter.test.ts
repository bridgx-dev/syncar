/**
 * EventEmitter Tests
 * Tests for the type-safe event emitter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from '../src/emitter/index.js'

// Define test event map
interface TestEventMap {
  connection: (client: { id: string }) => void
  message: (data: { text: string }, client: { id: string }) => void
  error: (error: Error) => void
  disconnect: (clientId: string) => void
}

describe('EventEmitter', () => {
  let emitter: EventEmitter<TestEventMap>

  beforeEach(() => {
    emitter = new EventEmitter<TestEventMap>()
  })

  describe('on()', () => {
    it('should register event handler and return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = emitter.on('connection', handler)

      expect(typeof unsubscribe).toBe('function')

      // Emit event
      emitter.emit('connection', { id: 'client-1' })
      expect(handler).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsubscribe()

      // Emit again - handler should not be called
      emitter.emit('connection', { id: 'client-2' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should support multiple handlers for the same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('connection', handler2)
      emitter.on('connection', handler3)

      emitter.emit('connection', { id: 'client-1' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)
    })

    it('should call handlers with correct arguments', () => {
      const handler = vi.fn()
      const client = { id: 'client-1' }

      emitter.on('connection', handler)
      emitter.emit('connection', client)

      expect(handler).toHaveBeenCalledWith(client)
    })

    it('should handle multiple parameters in handlers', () => {
      const handler = vi.fn()
      const data = { text: 'hello' }
      const client = { id: 'client-1' }

      emitter.on('message', handler)
      emitter.emit('message', data, client)

      expect(handler).toHaveBeenCalledWith(data, client)
    })
  })

  describe('once()', () => {
    it('should register one-time handler and auto-remove after emission', () => {
      const handler = vi.fn()

      emitter.once('connection', handler)

      // First emit - handler should be called
      emitter.emit('connection', { id: 'client-1' })
      expect(handler).toHaveBeenCalledTimes(1)

      // Second emit - handler should NOT be called
      emitter.emit('connection', { id: 'client-2' })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = emitter.once('connection', handler)

      expect(typeof unsubscribe).toBe('function')

      // Should be able to manually unsubscribe
      unsubscribe()

      emitter.emit('connection', { id: 'client-1' })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('off()', () => {
    it('should remove specific handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('connection', handler2)

      emitter.off('connection', handler1)

      emitter.emit('connection', { id: 'client-1' })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle removing non-existent handler gracefully', () => {
      const handler = vi.fn()

      expect(() => {
        emitter.off('connection', handler)
      }).not.toThrow()
    })

    it('should handle removing handler from wrong event gracefully', () => {
      const handler = vi.fn()

      emitter.on('message', handler)

      expect(() => {
        emitter.off('connection', handler)
      }).not.toThrow()
    })

    it('should remove once handler using off()', () => {
      const handler = vi.fn()
      const client = { id: 'client-1' }

      emitter.once('connection', handler)
      emitter.off('connection', handler)

      emitter.emit('connection', client)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should remove once handler when multiple once handlers exist', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.once('connection', handler1)
      emitter.once('connection', handler2)

      // Remove the first one
      emitter.off('connection', handler1)

      emitter.emit('connection', { id: 'client-1' })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should remove once handler when mixed with regular handlers', () => {
      const onceHandler = vi.fn()
      const regularHandler = vi.fn()

      emitter.once('connection', onceHandler)
      emitter.on('connection', regularHandler)

      // Remove the once handler
      emitter.off('connection', onceHandler)

      emitter.emit('connection', { id: 'client-1' })

      expect(onceHandler).not.toHaveBeenCalled()
      expect(regularHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('emit()', () => {
    it('should call all registered handlers for an event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('connection', handler2)
      emitter.on('message', handler3)

      emitter.emit('connection', { id: 'client-1' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).not.toHaveBeenCalled()
    })

    it('should not throw when emitting to event with no handlers', () => {
      expect(() => {
        emitter.emit('connection', { id: 'client-1' })
      }).not.toThrow()
    })

    it('should handle handler errors without breaking emission', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const handler1 = vi.fn(() => {
        throw new Error('Handler error')
      })
      const handler2 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('connection', handler2)

      emitter.emit('connection', { id: 'client-1' })

      // Both handlers should be called, even though handler1 threw
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  describe('removeAllListeners()', () => {
    it('should remove all listeners for a specific event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('connection', handler2)
      emitter.on('message', handler3)

      emitter.removeAllListeners('connection')

      emitter.emit('connection', { id: 'client-1' })
      emitter.emit('message', { text: 'test' }, { id: 'client-1' })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(handler3).toHaveBeenCalledTimes(1)
    })

    it('should remove all listeners for all events when no event specified', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('message', handler2)

      emitter.removeAllListeners()

      emitter.emit('connection', { id: 'client-1' })
      emitter.emit('message', { text: 'test' }, { id: 'client-1' })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('listenerCount()', () => {
    it('should return 0 for events with no listeners', () => {
      expect(emitter.listenerCount('connection')).toBe(0)
    })

    it('should return correct count for events with listeners', () => {
      emitter.on('connection', () => {})
      emitter.on('connection', () => {})
      emitter.on('message', () => {})

      expect(emitter.listenerCount('connection')).toBe(2)
      expect(emitter.listenerCount('message')).toBe(1)
    })

    it('should update count after adding and removing listeners', () => {
      const handler = vi.fn()

      expect(emitter.listenerCount('connection')).toBe(0)

      const unsubscribe = emitter.on('connection', handler)
      expect(emitter.listenerCount('connection')).toBe(1)

      unsubscribe()
      expect(emitter.listenerCount('connection')).toBe(0)
    })
  })

  describe('eventNames()', () => {
    it('should return empty array when no listeners', () => {
      expect(emitter.eventNames()).toEqual([])
    })

    it('should return array of event names that have listeners', () => {
      emitter.on('connection', () => {})
      emitter.on('message', () => {})
      emitter.on('connection', () => {}) // Add second listener to same event

      const names = emitter.eventNames()

      expect(names).toContain('connection')
      expect(names).toContain('message')
      expect(names).not.toContain('error')
    })

    it('should not duplicate event names with multiple listeners', () => {
      emitter.on('connection', () => {})
      emitter.on('connection', () => {})
      emitter.on('connection', () => {})

      expect(
        emitter.eventNames().filter((n) => n === 'connection'),
      ).toHaveLength(1)
    })
  })

  describe('hasListeners()', () => {
    it('should return false for events with no listeners', () => {
      expect(emitter.hasListeners('connection')).toBe(false)
    })

    it('should return true for events with listeners', () => {
      emitter.on('connection', () => {})

      expect(emitter.hasListeners('connection')).toBe(true)
      expect(emitter.hasListeners('message')).toBe(false)
    })

    it('should return false after all listeners removed', () => {
      const handler = vi.fn()
      emitter.on('connection', handler)

      expect(emitter.hasListeners('connection')).toBe(true)

      emitter.off('connection', handler)

      expect(emitter.hasListeners('connection')).toBe(false)
    })
  })

  describe('rawListeners', () => {
    it('should return Map of listeners', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('connection', handler1)
      emitter.on('connection', handler2)

      const listeners = emitter.rawListeners

      expect(listeners).toBeInstanceOf(Map)
      expect(listeners.get('connection')).toBeInstanceOf(Set)
      expect(listeners.get('connection')?.size).toBe(2)
    })

    it('should be empty when no listeners registered', () => {
      const listeners = emitter.rawListeners

      expect(listeners.size).toBe(0)
    })
  })
})
