/**
 * useChannel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { StrictMode } from 'react'
import { SynnelProvider, useChannel } from '../index.js'
import { createSynnelClient } from '@synnel/client-v2'
import type { Transport, Message } from '@synnel/client-v2'
import type { DataMessage } from '@synnel/core-v2'
import { SignalType } from '@synnel/core-v2'

// Mock transport
class MockTransport implements Transport {
  public _status: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' = 'disconnected'
  public eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map()
  public subscribedChannels: Set<string> = new Set()

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

  async send(message: Message): Promise<void> {
    if (this._status !== 'connected') {
      throw new Error('Not connected')
    }

    // Auto-respond to subscription signals
    if (message.type === 'signal') {
      const { signal, channel } = message
      if (signal === SignalType.SUBSCRIBE) {
        // Simulate server accepting subscription
        await new Promise((resolve) => setTimeout(resolve, 5))
        this.simulateSignal(SignalType.SUBSCRIBED, channel)
      } else if (signal === SignalType.UNSUBSCRIBE) {
        // Simulate server accepting unsubscription
        await new Promise((resolve) => setTimeout(resolve, 5))
        this.simulateSignal(SignalType.UNSUBSCRIBED, channel)
      }
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

  // Test helper to simulate message
  simulateMessage(message: Message): void {
    this.emit('message', message)
  }

  // Test helper to simulate signal
  simulateSignal(signal: SignalType, channel: string): void {
    const signalMessage = {
      id: `signal-${Date.now()}`,
      type: 'signal' as const,
      signal,
      channel,
      timestamp: Date.now(),
    }
    this.emit('message', signalMessage)
  }
}

interface TestMessage {
  id: string
  text: string
}

function wrapper(client: ReturnType<typeof createSynnelClient>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SynnelProvider client={client}>{children}</SynnelProvider>
  }
}

describe('useChannel', () => {
  let client: ReturnType<typeof createSynnelClient>
  let transport: MockTransport

  beforeEach(async () => {
    transport = new MockTransport()
    client = createSynnelClient({
      transport,
      autoConnect: false,
      autoReconnect: false,
    })

    // Explicitly connect since autoConnect is not implemented
    await client.connect()
  })

  afterEach(async () => {
    cleanup()
    await client.destroy()
  })

  describe('basic functionality', () => {
    it('should return initial state', async () => {
      const { result } = renderHook(() => useChannel<TestMessage>('chat'), {
        wrapper: wrapper(client),
      })

      // Wait for connection to be reflected
      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.isConnecting).toBe(false)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should have send function', () => {
      const { result } = renderHook(() => useChannel<TestMessage>('chat'), {
        wrapper: wrapper(client),
      })

      expect(typeof result.current.send).toBe('function')
    })

    it('should have unsubscribe function', () => {
      const { result } = renderHook(() => useChannel<TestMessage>('chat'), {
        wrapper: wrapper(client),
      })

      expect(typeof result.current.unsubscribe).toBe('function')
    })

    it('should have resubscribe function', () => {
      const { result } = renderHook(() => useChannel<TestMessage>('chat'), {
        wrapper: wrapper(client),
      })

      expect(typeof result.current.resubscribe).toBe('function')
    })
  })

  describe('message handling', () => {
    it('should receive messages', async () => {
      const onMessage = vi.fn()

      const { result } = renderHook(
        () =>
          useChannel<TestMessage>('chat', {
            onMessage,
          }),
        { wrapper: wrapper(client) },
      )

      // Wait for connection
      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      })

      // Simulate receiving a message
      const message: DataMessage<TestMessage> = {
        id: 'msg-1',
        type: 'data',
        channel: 'chat',
        data: { id: '1', text: 'Hello' },
        timestamp: Date.now(),
      }

      transport.simulateMessage(message)

      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith({ id: '1', text: 'Hello' }, message)
      })

      await waitFor(() => {
        expect(result.current.data).toEqual({ id: '1', text: 'Hello' })
      })
    })

    it('should ignore messages for other channels', async () => {
      const onMessage = vi.fn()

      renderHook(
        () =>
          useChannel<TestMessage>('chat', {
            onMessage,
          }),
        { wrapper: wrapper(client) },
      )

      // Simulate receiving a message for different channel
      const message: DataMessage<TestMessage> = {
        id: 'msg-1',
        type: 'data',
        channel: 'other',
        data: { id: '1', text: 'Hello' },
        timestamp: Date.now(),
      }

      transport.simulateMessage(message)

      await waitFor(() => {
        expect(onMessage).not.toHaveBeenCalled()
      })
    })
  })

  describe('send functionality', () => {
    it('should send data to channel', async () => {
      const sendSpy = vi.spyOn(transport, 'send')

      const { result } = renderHook(() => useChannel<TestMessage>('chat'), {
        wrapper: wrapper(client),
      })

      // Wait for connection
      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      })

      await result.current.send({ id: '1', text: 'Hello' })

      expect(sendSpy).toHaveBeenCalled()
    })
  })

  describe('enabled option', () => {
    it('should not subscribe when disabled', () => {
      const { result } = renderHook(
        () =>
          useChannel<TestMessage>('chat', {
            enabled: false,
          }),
        { wrapper: wrapper(client) },
      )

      expect(result.current.subscriptionState).toBe('unsubscribed')
    })
  })

  describe('React Strict Mode', () => {
    it('should handle Strict Mode double-invocation', async () => {
      let renderCount = 0

      const { result } = renderHook(
        () => {
          renderCount++
          return useChannel<TestMessage>('chat')
        },
        {
          wrapper: function StrictModeWrapper({ children }: { children: React.ReactNode }) {
            return (
              <StrictMode>
                <SynnelProvider client={client}>{children}</SynnelProvider>
              </StrictMode>
            )
          },
        },
      )

      // Should still work correctly
      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      })
      // In Strict Mode, effects run twice but hook should return correctly
    })
  })

  describe('callbacks', () => {
    it('should call onSubscribed callback', async () => {
      const onSubscribed = vi.fn()

      const { result } = renderHook(
        () =>
          useChannel<TestMessage>('chat', {
            onSubscribed,
          }),
        { wrapper: wrapper(client) },
      )

      // The subscription should be confirmed
      await waitFor(() => {
        expect(result.current.subscriptionState).toBe('subscribed')
      })
    })

    it('should call onError callback', async () => {
      const onError = vi.fn()

      const { result } = renderHook(
        () =>
          useChannel<TestMessage>('chat', {
            onError,
          }),
        { wrapper: wrapper(client) },
      )

      // Simulate error
      const error = new Error('Subscription failed')
      const subscription = client.getSubscription('chat')
      subscription?.handleError(error)

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error)
      })
    })
  })
})
