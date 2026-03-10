/**
 * useBroadcast Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { StrictMode } from 'react'
import { SyncarProvider, useBroadcast } from '../index.js'
import { createSyncarClient } from '@syncar/client'
import type { Transport, Message } from '@syncar/client'
import type { DataMessage } from '@syncar/core'

// Mock transport
class MockTransport implements Transport {
    public _status:
        | 'disconnected'
        | 'connecting'
        | 'connected'
        | 'disconnecting' = 'disconnected'
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

    async send(message: Message): Promise<void> {
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
        return {
            connectedAt: this._status === 'connected' ? Date.now() : undefined,
            url: 'ws://localhost:3000',
        }
    }

    // Test helper to simulate message
    simulateMessage(message: Message): void {
        this.emit('message', message)
    }
}

interface TestBroadcast {
    type: string
    value: number
}

function wrapper(client: ReturnType<typeof createSyncarClient>) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <SyncarProvider client={client}>{children}</SyncarProvider>
    }
}

describe('useBroadcast', () => {
    let client: ReturnType<typeof createSyncarClient>
    let transport: MockTransport

    beforeEach(async () => {
        transport = new MockTransport()
        client = createSyncarClient({
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
        it('should return initial state', () => {
            const { result } = renderHook(() => useBroadcast<TestBroadcast>(), {
                wrapper: wrapper(client),
            })

            expect(result.current.status).toBe('connected')
            expect(result.current.isConnected).toBe(true)
            expect(result.current.data).toBeNull()
            expect(result.current.error).toBeNull()
        })

        it('should have broadcast function', () => {
            const { result } = renderHook(() => useBroadcast<TestBroadcast>(), {
                wrapper: wrapper(client),
            })

            expect(typeof result.current.broadcast).toBe('function')
        })
    })

    describe('broadcast functionality', () => {
        it('should broadcast data', async () => {
            const sendSpy = vi.spyOn(transport, 'send')

            const { result } = renderHook(() => useBroadcast<TestBroadcast>(), {
                wrapper: wrapper(client),
            })

            await result.current.broadcast({ type: 'test', value: 42 })

            expect(sendSpy).toHaveBeenCalled()
        })

        it('should not broadcast when disabled', async () => {
            const sendSpy = vi.spyOn(transport, 'send')

            const { result } = renderHook(
                () =>
                    useBroadcast<TestBroadcast>({
                        enabled: false,
                    }),
                { wrapper: wrapper(client) },
            )

            await result.current.broadcast({ type: 'test', value: 42 })

            expect(sendSpy).not.toHaveBeenCalled()
        })
    })

    describe('message handling', () => {
        it('should receive broadcast messages', async () => {
            const onMessage = vi.fn()

            const { result } = renderHook(
                () =>
                    useBroadcast<TestBroadcast>({
                        onMessage,
                    }),
                { wrapper: wrapper(client) },
            )

            // Simulate receiving a broadcast message
            const message: DataMessage<TestBroadcast> = {
                id: 'msg-1',
                type: 'data',
                channel: '__broadcast__',
                data: { type: 'test', value: 42 },
                timestamp: Date.now(),
            }

            transport.simulateMessage(message)

            await waitFor(() => {
                expect(onMessage).toHaveBeenCalledWith(
                    { type: 'test', value: 42 },
                    message,
                )
            })

            await waitFor(() => {
                expect(result.current.data).toEqual({ type: 'test', value: 42 })
            })
        })

        it('should ignore non-broadcast messages', async () => {
            const onMessage = vi.fn()

            renderHook(
                () =>
                    useBroadcast<TestBroadcast>({
                        onMessage,
                    }),
                { wrapper: wrapper(client) },
            )

            // Simulate receiving a non-broadcast message
            const message: DataMessage<TestBroadcast> = {
                id: 'msg-1',
                type: 'data',
                channel: 'chat',
                data: { type: 'test', value: 42 },
                timestamp: Date.now(),
            }

            transport.simulateMessage(message)

            await waitFor(() => {
                expect(onMessage).not.toHaveBeenCalled()
            })
        })
    })

    describe('error handling', () => {
        it('should handle broadcast errors', async () => {
            const onError = vi.fn()
            const error = new Error('Broadcast failed')

            vi.spyOn(transport, 'send').mockRejectedValueOnce(error)

            const { result } = renderHook(
                () =>
                    useBroadcast<TestBroadcast>({
                        onError,
                    }),
                { wrapper: wrapper(client) },
            )

            await result.current.broadcast({ type: 'test', value: 42 })

            await waitFor(() => {
                expect(onError).toHaveBeenCalledWith(error)
            })

            await waitFor(() => {
                expect(result.current.error).toEqual(error)
            })
        })
    })

    describe('React Strict Mode', () => {
        it('should handle Strict Mode double-invocation', () => {
            const { result } = renderHook(() => useBroadcast<TestBroadcast>(), {
                wrapper: function StrictModeWrapper({
                    children,
                }: {
                    children: React.ReactNode
                }) {
                    return (
                        <StrictMode>
                            <SyncarProvider client={client}>
                                {children}
                            </SyncarProvider>
                        </StrictMode>
                    )
                },
            })

            // Should still work correctly
            expect(result.current.status).toBe('connected')
        })
    })

    describe('enabled option', () => {
        it('should not listen when disabled', async () => {
            const onMessage = vi.fn()

            renderHook(
                () =>
                    useBroadcast<TestBroadcast>({
                        onMessage,
                        enabled: false,
                    }),
                { wrapper: wrapper(client) },
            )

            // Simulate receiving a broadcast message
            const message: DataMessage<TestBroadcast> = {
                id: 'msg-1',
                type: 'data',
                channel: '__broadcast__',
                data: { type: 'test', value: 42 },
                timestamp: Date.now(),
            }

            transport.simulateMessage(message)

            await waitFor(() => {
                expect(onMessage).not.toHaveBeenCalled()
            })
        })
    })
})
