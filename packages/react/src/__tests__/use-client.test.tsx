/**
 * useSynnelClient Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { StrictMode } from 'react'
import { SynnelProvider, useSynnelClient } from '../index.js'
import { createSynnelClient } from '@synnel/client'
import type { Transport } from '@synnel/client'

// Mock transport
class MockTransport implements Transport {
  public _status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' = 'disconnected'
  public eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map()

  get status() {
    return this._status
  }

  async connect(): Promise<void> {
    this._status = 'connecting'
    await new Promise((resolve) => setTimeout(resolve, 10))
    this._status = 'connected'
    this.emit('open')
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnecting'
    await new Promise((resolve) => setTimeout(resolve, 10))
    this._status = 'disconnected'
    this.emit('close')
  }

  async send(): Promise<void> {
    if (this._status !== 'connected') {
      throw new Error('Not connected')
    }
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)

    return () => {
      this.eventHandlers.get(event)?.delete(handler)
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }

  getConnectionInfo() {
    return { connectedAt: this._status === 'connected' ? Date.now() : undefined, url: 'ws://localhost:3000' }
  }
}

function wrapper(client: ReturnType<typeof createSynnelClient>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SynnelProvider client={client}>{children}</SynnelProvider>
  }
}

describe('useSynnelClient', () => {
  let client: ReturnType<typeof createSynnelClient>
  let transport: MockTransport

  beforeEach(() => {
    transport = new MockTransport()
    client = createSynnelClient({
      transport,
      autoConnect: false,
      autoReconnect: false,
    })
  })

  afterEach(async () => {
    cleanup()
    await client.destroy()
  })

  describe('basic functionality', () => {
    it('should return the client instance', () => {
      const { result } = renderHook(() => useSynnelClient(), {
        wrapper: wrapper(client),
      })

      expect(result.current).toBe(client)
    })

    it('should allow accessing client methods', async () => {
      const { result } = renderHook(() => useSynnelClient(), {
        wrapper: wrapper(client),
      })

      expect(typeof result.current.connect).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
      expect(typeof result.current.subscribe).toBe('function')
      expect(typeof result.current.publish).toBe('function')
      expect(typeof result.current.getStats).toBe('function')
    })

    it('should have correct initial status', () => {
      const { result } = renderHook(() => useSynnelClient(), {
        wrapper: wrapper(client),
      })

      expect(result.current.status).toBe('disconnected')
    })

    it('should update status on connect', async () => {
      const { result } = renderHook(() => useSynnelClient(), {
        wrapper: wrapper(client),
      })

      expect(result.current.status).toBe('disconnected')

      await result.current.connect()

      // Status should update after connection
      expect(result.current.status).toBe('connected')
    })

    it('should update stats correctly', () => {
      const { result } = renderHook(() => useSynnelClient(), {
        wrapper: wrapper(client),
      })

      const stats = result.current.getStats()

      expect(stats).toHaveProperty('id')
      expect(stats).toHaveProperty('status')
      expect(stats).toHaveProperty('subscriptions')
      expect(stats).toHaveProperty('messagesReceived')
      expect(stats).toHaveProperty('messagesSent')
    })
  })

  describe('state updates', () => {
    it('should trigger re-render on status change', async () => {
      let renderCount = 0

      const { result } = renderHook(() => {
        renderCount++
        return useSynnelClient()
      }, { wrapper: wrapper(client) })

      const initialRenderCount = renderCount

      await result.current.connect()

      // Should trigger re-render
      expect(renderCount).toBeGreaterThan(initialRenderCount)
    })
  })

  describe('React Strict Mode', () => {
    it('should handle Strict Mode double-invocation', () => {
      let renderCount = 0

      renderHook(() => {
        renderCount++
        return useSynnelClient()
      }, {
        wrapper: function StrictModeWrapper({ children }: { children: React.ReactNode }) {
          return (
            <StrictMode>
              <SynnelProvider client={client}>{children}</SynnelProvider>
            </StrictMode>
          )
        },
      })

      // In Strict Mode, effects run twice but component should still work
      expect(renderCount).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should throw when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        renderHook(() => useSynnelClient())
      }).toThrow()

      console.error = originalError
    })
  })
})
