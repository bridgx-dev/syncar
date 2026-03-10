/**
 * ConnectionManager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConnectionManager } from '../connection-manager.js'
import type { Transport, ClientConfig } from '../types.js'

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

        // Simulate async connection
        await new Promise((resolve) => setTimeout(resolve, 10))

        this._status = 'connected'
        this.emit('open')
    }

    async disconnect(): Promise<void> {
        this._status = 'disconnecting'

        // Simulate async disconnection
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
        return {
            connectedAt: this._status === 'connected' ? Date.now() : undefined,
            url: 'ws://localhost:3000',
        }
    }
}

describe('ConnectionManager', () => {
    let manager: ConnectionManager
    let transport: MockTransport

    beforeEach(() => {
        transport = new MockTransport()

        const config: ClientConfig = {
            transport,
            autoReconnect: true,
            maxReconnectAttempts: 5,
            reconnectDelay: 100,
            maxReconnectDelay: 1000,
        }

        manager = new ConnectionManager(config)
    })

    afterEach(async () => {
        await manager.disconnect()
    })

    describe('constructor', () => {
        it('should initialize with disconnected status', () => {
            expect(manager.status).toBe('disconnected')
        })

        it('should accept custom config', () => {
            const customManager = new ConnectionManager({
                transport,
                autoReconnect: false,
            })

            expect(customManager.status).toBe('disconnected')
        })
    })

    describe('connect', () => {
        it('should connect to the transport', async () => {
            await manager.connect()

            expect(manager.status).toBe('connected')
        })

        it('should be idempotent when already connecting', async () => {
            const connectPromise1 = manager.connect()
            const connectPromise2 = manager.connect()

            await connectPromise1
            await connectPromise2

            expect(manager.status).toBe('connected')
        })

        it('should handle connection failure', async () => {
            transport.connect = async () => {
                transport._status = 'connecting'
                throw new Error('Connection failed')
            }

            try {
                await manager.connect()
            } catch {
                // Expected to fail
            }

            expect(manager.getReconnectionState().attempts).toBe(1)
        })
    })

    describe('disconnect', () => {
        it('should disconnect from the transport', async () => {
            await manager.connect()

            expect(manager.status).toBe('connected')

            await manager.disconnect()

            expect(manager.status).toBe('disconnected')
        })

        it('should clear pending reconnection on disconnect', async () => {
            transport.connect = async () => {
                throw new Error('Connection failed')
            }

            try {
                await manager.connect()
            } catch {
                // Expected to fail
            }

            expect(manager.getReconnectionState().attempts).toBe(1)

            await manager.disconnect()

            // Reconnection should be cleared
            expect(manager.getReconnectionState().attempts).toBe(0)
        })

        it('should be idempotent', async () => {
            await manager.connect()

            await manager.disconnect()
            await manager.disconnect()

            expect(manager.status).toBe('disconnected')
        })
    })

    describe('reconnection', () => {
        it('should reconnect with exponential backoff', async () => {
            let connectAttempts = 0
            const reconnectHandler = vi.fn()

            transport.connect = async () => {
                transport._status = 'connecting'
                connectAttempts++

                if (connectAttempts < 3) {
                    throw new Error('Connection failed')
                }

                transport._status = 'connected'
                transport.emit('open')
            }

            manager.onReconnecting(reconnectHandler)

            try {
                await manager.connect()
            } catch {
                // Expected to fail
            }

            // Wait for reconnections to complete
            await new Promise((resolve) => setTimeout(resolve, 500))

            expect(connectAttempts).toBeGreaterThan(1)
            expect(reconnectHandler).toHaveBeenCalled()
        })

        it('should stop reconnecting after max attempts', async () => {
            transport.connect = async () => {
                throw new Error('Connection failed')
            }

            try {
                await manager.connect()
            } catch {
                // Expected to fail
            }

            // Wait for all reconnection attempts with exponential backoff
            // 5 attempts: 100ms + 200ms + 400ms + 800ms + 1600ms = ~3100ms
            // Add some buffer for the actual connection attempts
            await new Promise((resolve) => setTimeout(resolve, 4000))

            // Should have stopped trying
            const state = manager.getReconnectionState()
            expect(state.attempts).toBeGreaterThanOrEqual(state.maxAttempts)
        })

        it('should not reconnect if autoReconnect is disabled', async () => {
            const noReconnectManager = new ConnectionManager({
                transport,
                autoReconnect: false,
            })

            transport.connect = async () => {
                throw new Error('Connection failed')
            }

            try {
                await noReconnectManager.connect()
            } catch {
                // Expected to fail
            }

            await new Promise((resolve) => setTimeout(resolve, 500))

            expect(noReconnectManager.getReconnectionState().attempts).toBe(0)
        })
    })

    describe('status change handlers', () => {
        it('should notify status changes', async () => {
            const statuses: string[] = []
            manager.onStatusChange((status) => statuses.push(status))

            await manager.connect()

            expect(statuses).toContain('connecting')
            expect(statuses).toContain('connected')
        })

        it('should unsubscribe handler when returned function is called', async () => {
            const handler = vi.fn()
            const unsubscribe = manager.onStatusChange(handler)

            unsubscribe()

            await manager.connect()

            // Handler should not be called
            expect(handler).not.toHaveBeenCalled()
        })
    })

    describe('setAutoReconnect', () => {
        it('should enable/disable auto-reconnect', () => {
            expect(manager.getReconnectionState().enabled).toBe(true)

            manager.setAutoReconnect(false)

            expect(manager.getReconnectionState().enabled).toBe(false)

            manager.setAutoReconnect(true)

            expect(manager.getReconnectionState().enabled).toBe(true)
        })

        it('should clear reconnection state when disabled', async () => {
            transport.connect = async () => {
                throw new Error('Connection failed')
            }

            try {
                await manager.connect()
            } catch {
                // Expected to fail
            }

            expect(manager.getReconnectionState().attempts).toBe(1)

            manager.setAutoReconnect(false)

            expect(manager.getReconnectionState().attempts).toBe(0)
        })
    })
})
