/**
 * Transport Tests
 * Tests for transport interfaces and base transport functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BaseTransport, WebSocketServerTransport } from '../src/transport/index.js'
import type { IClientConnection, ClientId } from '../src/types/index.js'
import type { ClientId as ClientIdType } from '@synnel/types'
import { MessageType } from '@synnel/types'

// Mock client connection
function createMockClient(id: string): IClientConnection {
  return {
    id: id as ClientIdType,
    socket: {
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    } as any,
    connectedAt: Date.now(),
    lastPingAt: undefined,
  }
}

// Mock transport extending BaseTransport
class MockTransport extends BaseTransport {}

describe('Transport', () => {
  describe('BaseTransport', () => {
    let transport: MockTransport

    beforeEach(() => {
      transport = new MockTransport()
    })

    describe('initialization', () => {
      it('should create empty connections map', () => {
        expect(transport.connections).toBeInstanceOf(Map)
        expect(transport.connections.size).toBe(0)
      })

      it('should accept shared connections map', () => {
        const sharedMap = new Map<ClientId, IClientConnection>()
        const transportWithShared = new MockTransport(sharedMap)
        expect(transportWithShared.connections).toBe(sharedMap)
      })
    })

    describe('client management', () => {
      it('should allow directly accessing connections', () => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')

        transport.connections.set('client-1' as ClientIdType, client1)
        transport.connections.set('client-2' as ClientIdType, client2)

        expect(transport.connections.size).toBe(2)
        expect(transport.connections.get('client-1' as ClientIdType)).toBe(client1)
      })
    })

    describe('EventEmitter integration', () => {
      it('should inherit event methods', () => {
        expect(typeof transport.on).toBe('function')
        expect(typeof transport.off).toBe('function')
        expect(typeof transport.emit).toBe('function')
        expect(typeof transport.once).toBe('function')
      })

      it('should support event registration', () => {
        const handler = vi.fn()
        transport.on('test' as any, handler)
        transport.emit('test' as any, 'arg1', 'arg2')
        expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
      })
    })
  })

  describe('WebSocketServerTransport', () => {
    // Mock WebSocket and WebSocketServer
    const createMockWebSocket = (_id: string) => {
      const ws = {
        readyState: 1, // OPEN
        send: vi.fn((_data: string, cb?: (err?: Error) => void) => {
          cb?.()
        }),
        ping: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
      }
      return ws
    }

    const createMockWsServer = () => {
      const wsServer = {
        on: vi.fn(),
        off: vi.fn(),
        close: vi.fn(),
        clients: new Set(),
      }
      return wsServer
    }

    let mockWsServer: any
    let mockServer: any
    let transport: WebSocketServerTransport

    beforeEach(() => {
      mockWsServer = createMockWsServer()
      mockServer = {
        listen: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      }
    })

    afterEach(() => {
      if (transport) {
        transport.stop()
      }
    })

    describe('constructor', () => {
      it('should create with default config', () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        expect(transport).toBeInstanceOf(WebSocketServerTransport)
        expect(transport.connections).toBeInstanceOf(Map)
      })
    })

    describe('connection handling', () => {
      it('should add client on connection', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection event
        const mockSocket = createMockWebSocket('test-client')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        expect(connections.size).toBe(1)
      })
    })

    describe('ping/pong handling', () => {
      it('should set up health check interval when enabled', async () => {
        vi.useFakeTimers()
        const connections = new Map<ClientId, IClientConnection>()
        
        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 100,
          pingTimeout: 50,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const mockSocket = createMockWebSocket('client-1')
        transport.connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket as any,
          connectedAt: Date.now(),
        })

        await transport.start()
        vi.advanceTimersByTime(110)
        expect(mockSocket.ping).toHaveBeenCalled()
        
        vi.useRealTimers()
      })

      it('should close socket on ping timeout', async () => {
        vi.useFakeTimers()
        const connections = new Map<ClientId, IClientConnection>()
        
        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 100,
          pingTimeout: 50,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const mockSocket = createMockWebSocket('client-1')
        transport.connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket as any,
          connectedAt: Date.now(),
          lastPingAt: Date.now() - 100 // Timed out
        })

        await transport.start()
        vi.advanceTimersByTime(110)
        expect(mockSocket.close).toHaveBeenCalledWith(1000, 'Ping timeout')
        
        vi.useRealTimers()
      })
    })

    describe('stop', () => {
      it('should clear all connections', async () => {
        const connections = new Map<ClientId, IClientConnection>()
        const mockSocket = createMockWebSocket('client-1')
        connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket as any,
          connectedAt: Date.now(),
        })

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        await transport.start()
        transport.stop()
        expect(connections.size).toBe(0)
        expect(mockWsServer.close).toHaveBeenCalled()
      })
    })
  })
})
