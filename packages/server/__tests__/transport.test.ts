/**
 * Transport Tests
 * Tests for transport interfaces and base transport functionality
 */

import { describe, it, expect } from 'vitest'
import { BaseTransport } from '../src/transport/index.js'
import type { IClientConnection, ClientId, Message } from '../src/types/index.js'

// Mock client connection
function createMockClient(id: string): IClientConnection {
  return {
    id,
    socket: {
      send: vi.fn(),
      close: vi.fn(),
    } as any,
    status: 'connected' as const,
    connectedAt: Date.now(),
    lastPingAt: undefined,
  }
}

// Mock transport extending BaseTransport
class MockTransport extends BaseTransport {
  async sendToClient(_clientId: ClientId, _message: Message): Promise<void> {
    // Mock implementation
  }
}

describe('Transport', () => {
  describe('BaseTransport', () => {
    let transport: MockTransport

    beforeEach(() => {
      transport = new MockTransport()
    })

    describe('initialization', () => {
      it('should create empty connections map', () => {
        expect(transport.connections).toBeInstanceOf(Map)
        expect(transport.getClientCount()).toBe(0)
      })

      it('should accept shared connections map', () => {
        const sharedMap = new Map<ClientId, IClientConnection>()

        const transportWithShared = new MockTransport(sharedMap)

        expect(transportWithShared.connections).toBe(sharedMap)
      })
    })

    describe('client management', () => {
      it('should get all clients', () => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')

        transport.connections.set('client-1', client1)
        transport.connections.set('client-2', client2)

        const clients = transport.getClients()

        expect(clients).toHaveLength(2)
        expect(clients).toContain(client1)
        expect(clients).toContain(client2)
      })

      it('should get client by ID', () => {
        const client = createMockClient('client-1')
        transport.connections.set('client-1', client)

        expect(transport.getClient('client-1')).toBe(client)
      })

      it('should return undefined for non-existent client', () => {
        expect(transport.getClient('non-existent')).toBeUndefined()
      })

      it('should get client count', () => {
        expect(transport.getClientCount()).toBe(0)

        transport.connections.set('client-1', createMockClient('client-1'))
        expect(transport.getClientCount()).toBe(1)

        transport.connections.set('client-2', createMockClient('client-2'))
        expect(transport.getClientCount()).toBe(2)
      })
    })

    describe('disconnectClient', () => {
      it('should disconnect specific client', () => {
        const client = createMockClient('client-1')
        const closeSpy = vi.spyOn(client.socket, 'close')

        transport.connections.set('client-1', client)

        const result = transport.disconnectClient('client-1', 4000, 'Test reason')

        expect(result).toBe(true)
        expect(closeSpy).toHaveBeenCalledWith(4000, 'Test reason')
      })

      it('should return false for non-existent client', () => {
        const result = transport.disconnectClient('non-existent')

        expect(result).toBe(false)
      })

      it('should handle close errors gracefully', () => {
        const client = createMockClient('client-1')
        vi.spyOn(client.socket, 'close').mockImplementation(() => {
          throw new Error('Close error')
        })

        transport.connections.set('client-1', client)

        const result = transport.disconnectClient('client-1')

        expect(result).toBe(false)
      })
    })

    describe('disconnectAll', () => {
      it('should disconnect all clients', () => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')
        const closeSpy1 = vi.spyOn(client1.socket, 'close')
        const closeSpy2 = vi.spyOn(client2.socket, 'close')

        transport.connections.set('client-1', client1)
        transport.connections.set('client-2', client2)

        transport.disconnectAll(4001, 'Shutdown')

        expect(closeSpy1).toHaveBeenCalledWith(4001, 'Shutdown')
        expect(closeSpy2).toHaveBeenCalledWith(4001, 'Shutdown')
      })

      it('should handle errors during disconnect all', () => {
        const client1 = createMockClient('client-1')
        const client2 = createMockClient('client-2')

        vi.spyOn(client1.socket, 'close').mockImplementation(() => {
          throw new Error('Error')
        })

        transport.connections.set('client-1', client1)
        transport.connections.set('client-2', client2)

        // Should not throw
        expect(() => transport.disconnectAll()).not.toThrow()
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

        transport.on('test', handler)
        transport.emit('test', 'arg1', 'arg2')

        expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
      })

      it('should support once listeners', () => {
        const handler = vi.fn()

        transport.once('test', handler)
        transport.emit('test')
        transport.emit('test')

        expect(handler).toHaveBeenCalledTimes(1)
      })

      it('should support removing listeners', () => {
        const handler = vi.fn()

        transport.on('test', handler)
        transport.off('test', handler)
        transport.emit('test')

        expect(handler).not.toHaveBeenCalled()
      })

      it('should support removeAllListeners', () => {
        const handler1 = vi.fn()
        const handler2 = vi.fn()

        transport.on('test', handler1)
        transport.on('test', handler2)

        transport.removeAllListeners('test')
        transport.emit('test')

        expect(handler1).not.toHaveBeenCalled()
        expect(handler2).not.toHaveBeenCalled()
      })

      it('should support listenerCount', () => {
        transport.on('test', () => {})
        transport.on('test', () => {})

        expect(transport.listenerCount('test')).toBe(2)
      })

      it('should support eventNames', () => {
        transport.on('event1', () => {})
        transport.on('event2', () => {})

        const names = transport.eventNames()

        expect(names).toContain('event1')
        expect(names).toContain('event2')
      })
    })
  })

  describe('Transport Interfaces', () => {
    it('should export BaseTransport class', () => {
      expect(BaseTransport).toBeDefined()
    })

    it('should be extendable', () => {
      class CustomTransport extends BaseTransport {
        async sendToClient(_clientId: ClientId, _message: Message): Promise<void> {
          // Custom implementation
        }
      }

      const transport = new CustomTransport()

      expect(transport).toBeInstanceOf(BaseTransport)
      expect(typeof transport.sendToClient).toBe('function')
    })
  })
})
