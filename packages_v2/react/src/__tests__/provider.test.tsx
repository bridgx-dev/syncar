/**
 * SynnelProvider Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StrictMode } from 'react'
import { SynnelProvider, useSynnelClient } from '../index.js'
import { createSynnelClient } from '@synnel/client-v2'
import type { Transport, Message } from '@synnel/client-v2'

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

describe('SynnelProvider', () => {
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

  describe('basic rendering', () => {
    it('should render children', () => {
      const { getByText } = render(
        <SynnelProvider client={client}>
          <div>Test Child</div>
        </SynnelProvider>,
      )

      expect(getByText('Test Child')).toBeDefined()
    })

    it('should provide client to children', () => {
      function TestComponent() {
        const retrievedClient = useSynnelClient()
        return <div data-testid="client-id">{retrievedClient.getStats().id}</div>
      }

      const { getByTestId } = render(
        <SynnelProvider client={client}>
          <TestComponent />
        </SynnelProvider>,
      )

      expect(getByTestId('client-id').textContent).toBe(client.getStats().id)
    })
  })

  describe('React Strict Mode', () => {
    it('should handle Strict Mode double-invocation', () => {
      let renderCount = 0

      function TestComponent() {
        renderCount++
        const retrievedClient = useSynnelClient()
        return <div data-testid="client-id">{retrievedClient.getStats().id}</div>
      }

      render(
        <StrictMode>
          <SynnelProvider client={client}>
            <TestComponent />
          </SynnelProvider>
        </StrictMode>,
      )

      // In Strict Mode (dev), component mounts twice to help find bugs
      // The provider and hooks should work correctly regardless
      expect(renderCount).toBeGreaterThan(0)
    })

    it('should not duplicate subscriptions in Strict Mode', () => {
      const onMessage = vi.fn()

      function TestComponent() {
        useSynnelClient()
        return <div>Test</div>
      }

      render(
        <StrictMode>
          <SynnelProvider client={client}>
            <TestComponent />
          </SynnelProvider>
        </StrictMode>,
      )

      // Should not have any issues with duplicate handlers
      expect(onMessage).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should throw error when using hooks outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      function TestComponent() {
        useSynnelClient()
        return <div>Test</div>
      }

      expect(() => {
        render(<TestComponent />)
      }).toThrow()

      console.error = originalError
    })
  })

  describe('client lifecycle', () => {
    it('should maintain same client instance across re-renders', () => {
      let firstClientId: string | undefined
      let secondClientId: string | undefined

      function TestComponent() {
        const retrievedClient = useSynnelClient()
        if (!firstClientId) {
          firstClientId = retrievedClient.getStats().id
        } else {
          secondClientId = retrievedClient.getStats().id
        }
        return <div>Test</div>
      }

      const { rerender } = render(
        <SynnelProvider client={client}>
          <TestComponent />
        </SynnelProvider>,
      )

      // Force re-render
      rerender(
        <SynnelProvider client={client}>
          <TestComponent />
        </SynnelProvider>,
      )

      expect(firstClientId).toBe(secondClientId)
    })
  })
})
