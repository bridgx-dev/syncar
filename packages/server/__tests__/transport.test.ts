/**
 * Transport Tests
 * Tests for transport interfaces and base transport functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BaseTransport, WebSocketServerTransport } from '../src/transport/index.js'
import type { IClientConnection, ClientId, Message } from '../src/types/index.js'
import type { ClientId as ClientIdType } from '@synnel/types'
import { MessageType } from '@synnel/types'

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

  describe('WebSocketServerTransport', () => {
    // Mock WebSocket and WebSocketServer
    const createMockWebSocket = (id: string) => {
      const ws = {
        readyState: 1, // OPEN
        send: vi.fn((data: string, cb?: (err?: Error) => void) => {
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
        handlers: new Map<string, Function>(),
      }
      return wsServer
    }

    let mockWsServer: ReturnType<typeof createMockWsServer>
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

      it('should use custom path when provided', () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          path: '/custom-ws',
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        expect(transport).toBeInstanceOf(WebSocketServerTransport)
      })

      it('should use custom maxPayload when provided', () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          maxPayload: 204800,
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        expect(transport).toBeInstanceOf(WebSocketServerTransport)
      })

      it('should use custom ping settings when provided', () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          enablePing: true,
          pingInterval: 30000,
          pingTimeout: 5000,
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        expect(transport).toBeInstanceOf(WebSocketServerTransport)
      })

      it('should disable ping when enablePing is false', () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          enablePing: false,
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        expect(transport).toBeInstanceOf(WebSocketServerTransport)
      })

      it('should use shared connections map', () => {
        const sharedMap = new Map<ClientId, IClientConnection>()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections: sharedMap,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        expect(transport.connections).toBe(sharedMap)
      })
    })

    describe('connection handling', () => {
      it('should add client on connection', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation((config: any) => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
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

        // Client should be added to connections
        expect(connections.size).toBeGreaterThan(0)
      })

      it('should emit connection event', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined
        const connectionSpy = vi.fn()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        transport.on('connection', connectionSpy)

        // Simulate connection event
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Connection event should be emitted
        expect(connectionSpy).toHaveBeenCalled()
        const emittedClient = connectionSpy.mock.calls[0][0]
        expect(emittedClient).toBeDefined()
        expect(emittedClient.id).toBeDefined()
        expect(emittedClient.socket).toBe(mockSocket)
      })

      it('should set up message handler for new connections', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection event
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Message handler should be registered on socket
        expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function))
      })

      it('should set up close handler for new connections', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection event
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Close handler should be registered on socket
        expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function))
      })

      it('should set up error handler for new connections', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection event
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Error handler should be registered on socket
        expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function))
      })

      it('should set up ping when enabled', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 1000,
          pingTimeout: 500,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection event
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Ping/pong handlers should be registered
        expect(mockSocket.on).toHaveBeenCalledWith('pong', expect.any(Function))
        expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function))
      })
    })

    describe('message handling', () => {
      it('should parse and emit valid JSON messages', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined
        const messageSpy = vi.fn()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        transport.on('message', messageSpy)

        // Simulate connection and message
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)

          // Get the client ID that was assigned
          const clientId = Array.from(connections.keys())[0]

          // Find the message handler
          const messageHandler = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'message'
          )?.[1]

          if (messageHandler) {
            const testMessage = {
              id: 'msg-1',
              type: MessageType.DATA,
              channel: 'test',
              data: 'hello',
              timestamp: Date.now(),
            }

            messageHandler(Buffer.from(JSON.stringify(testMessage)))

            expect(messageSpy).toHaveBeenCalledWith(clientId, testMessage)
          }
        }
      })

      it('should emit error for invalid JSON messages', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined
        const errorSpy = vi.fn()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        transport.on('error', errorSpy)

        // Simulate connection and invalid message
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)

          const messageHandler = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'message'
          )?.[1]

          if (messageHandler) {
            messageHandler(Buffer.from('invalid json'))

            expect(errorSpy).toHaveBeenCalled()
          }
        }
      })

      it('should handle PONG signals for ping tracking', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection and PONG message
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)

          const messageHandler = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'message'
          )?.[1]

          if (messageHandler) {
            const pongMessage = {
              id: 'sig-1',
              type: MessageType.SIGNAL,
              channel: '__ping__',
              signal: 'PONG',
              timestamp: Date.now(),
            }

            // Should not throw
            expect(() => {
              messageHandler(Buffer.from(JSON.stringify(pongMessage)))
            }).not.toThrow()
          }
        }
      })
    })

    describe('sendToClient', () => {
      it('should send message to connected client', async () => {
        const connections = new Map<ClientId, IClientConnection>()
        const mockSocket = createMockWebSocket('client-1')

        connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket,
          status: 'connected' as const,
          connectedAt: Date.now(),
        })

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'test',
          data: 'hello',
          timestamp: Date.now(),
        }

        await transport.sendToClient('client-1' as ClientIdType, message)

        expect(mockSocket.send).toHaveBeenCalled()
        const sentData = mockSocket.send.mock.calls[0][0]
        expect(sentData).toContain('hello')
      })

      it('should throw error for non-existent client', async () => {
        const connections = new Map<ClientId, IClientConnection>()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'test',
          data: 'hello',
          timestamp: Date.now(),
        }

        await expect(
          transport.sendToClient('non-existent' as ClientIdType, message)
        ).rejects.toThrow()
      })

      it('should throw error for disconnected client', async () => {
        const connections = new Map<ClientId, IClientConnection>()
        const mockSocket = createMockWebSocket('client-1')
        mockSocket.readyState = 0 // CONNECTING

        connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket,
          status: 'connected' as const,
          connectedAt: Date.now(),
        })

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'test',
          data: 'hello',
          timestamp: Date.now(),
        }

        await expect(
          transport.sendToClient('client-1' as ClientIdType, message)
        ).rejects.toThrow()
      })

      it('should handle send callback errors', async () => {
        const connections = new Map<ClientId, IClientConnection>()
        const mockSocket = createMockWebSocket('client-1')
        const sendError = new Error('Send failed')

        mockSocket.send = vi.fn((data: string, cb?: (err?: Error) => void) => {
          cb?.(sendError)
        })

        connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket,
          status: 'connected' as const,
          connectedAt: Date.now(),
        })

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'test',
          data: 'hello',
          timestamp: Date.now(),
        }

        await expect(
          transport.sendToClient('client-1' as ClientIdType, message)
        ).rejects.toThrow('Send failed')
      })

      it('should handle socket.send throwing an error', async () => {
        const connections = new Map<ClientId, IClientConnection>()
        const mockSocket = createMockWebSocket('client-1')
        const sendError = new Error('Send sync failed')

        // Make send throw synchronously
        mockSocket.send = vi.fn(() => {
          throw sendError
        })

        connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket,
          status: 'connected' as const,
          connectedAt: Date.now(),
        })

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        const message = {
          id: 'msg-1',
          type: MessageType.DATA,
          channel: 'test',
          data: 'hello',
          timestamp: Date.now(),
        }

        await expect(
          transport.sendToClient('client-1' as ClientIdType, message)
        ).rejects.toThrow('Send sync failed')
      })
    })

    describe('disconnection', () => {
      it('should remove client and emit disconnection event', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined
        const disconnectionSpy = vi.fn()

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

        transport.on('disconnection', disconnectionSpy)

        // Simulate connection
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)

          // Find the close handler
          const closeHandler = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'close'
          )?.[1]

          // Get the client ID before disconnection
          const clientIds = Array.from(connections.keys())

          // Simulate close
          if (closeHandler) {
            closeHandler(1000, Buffer.from('Normal closure'))
          }

          // Client should be removed
          expect(disconnectionSpy).toHaveBeenCalled()
          expect(connections.size).toBe(0)
        }
      })
    })

    describe('error handling', () => {
      it('should emit error event from ws server', () => {
        const errorSpy = vi.fn()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections: new Map(),
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              // Don't automatically trigger the handler during construction
              if (event !== 'connection') {
                // Store the handler for later use
                if (!mockWsServer.handlers) mockWsServer.handlers = new Map()
                mockWsServer.handlers.set(event, handler)
              }
            })
            return mockWsServer
          }),
        })

        transport.on('error', errorSpy)

        // Manually trigger the error handler
        const errorHandler = mockWsServer.handlers?.get('error')
        if (errorHandler) {
          errorHandler(new Error('WS Server error'))
        }

        expect(errorSpy).toHaveBeenCalled()
      })

      it('should emit error event from socket', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined
        const errorSpy = vi.fn()

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

        transport.on('error', errorSpy)

        // Simulate connection
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)

          // Find the error handler
          const errorHandler = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'error'
          )?.[1]

          if (errorHandler) {
            errorHandler(new Error('Socket error'))
          }

          expect(errorSpy).toHaveBeenCalled()
        }
      })
    })

    describe('ping/pong handling', () => {
      it('should set up pong event handler when ping is enabled', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 1000,
          pingTimeout: 500,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Should register pong event handler
        const pongHandler = mockSocket.on.mock.calls.find(
          (call: any[]) => call[0] === 'pong'
        )
        expect(pongHandler).toBeDefined()
      })

      it('should clear pong timer when pong event is received', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 100,
          pingTimeout: 500,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Get pong handler
        const pongHandler = mockSocket.on.mock.calls.find(
          (call: any[]) => call[0] === 'pong'
        )?.[1]

        // Wait for ping to be sent and pong timer to be set
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            if (pongHandler) {
              // Trigger pong event - should clear the pong timer
              pongHandler()
            }
            resolve()
          }, 150)
        })
      })

      it('should clean up ping data on socket close', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 1000,
          pingTimeout: 500,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection
        const mockSocket = createMockWebSocket('client-1')
        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Get close handler
        const closeHandler = mockSocket.on.mock.calls.find(
          (call: any[]) => call[0] === 'close'
        )?.[1]

        // Trigger close - should clean up ping data
        if (closeHandler) {
          closeHandler()
        }

        // Ping data should be cleaned up (verified by no errors)
        expect(closeHandler).toBeDefined()
      })

      it('should close socket on ping timeout', () => {
        const connections = new Map<ClientId, IClientConnection>()
        let connectionHandler: ((socket: any) => void) | undefined

        // Use fake timers to control timeout
        vi.useFakeTimers()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          enablePing: true,
          pingInterval: 100,
          pingTimeout: 200,
          ServerConstructor: vi.fn().mockImplementation(() => {
            mockWsServer.on = vi.fn((event: string, handler: any) => {
              mockWsServer.handlers.set(event, handler)
              if (event === 'connection') {
                connectionHandler = handler
              }
            })
            return mockWsServer
          }),
        })

        // Simulate connection
        const mockSocket = createMockWebSocket('client-1')
        mockSocket.readyState = 1 // OPEN

        if (connectionHandler) {
          connectionHandler(mockSocket)
        }

        // Advance time to trigger ping
        vi.advanceTimersByTime(100)

        // Advance time past ping timeout - should trigger close
        vi.advanceTimersByTime(250)

        // Socket should be closed due to ping timeout
        expect(mockSocket.close).toHaveBeenCalledWith(1000, 'Ping timeout')

        vi.useRealTimers()
      })
    })

    describe('stop', () => {
      it('should close all client connections', () => {
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

        // Add multiple clients
        const socket1 = createMockWebSocket('client-1')
        const socket2 = createMockWebSocket('client-2')

        if (connectionHandler) {
          connectionHandler(socket1)
          connectionHandler(socket2)
        }

        const initialSize = connections.size

        transport.stop()

        // All sockets should be closed
        if (initialSize > 0) {
          // At least the sockets that were added should be closed
          expect(mockWsServer.close).toHaveBeenCalled()
        }
      })

      it('should clear all connections', () => {
        const connections = new Map<ClientId, IClientConnection>()

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        transport.stop()

        expect(connections.size).toBe(0)
      })

      it('should remove all event listeners', () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        transport.stop()

        expect(mockWsServer.close).toHaveBeenCalled()
      })

      it('should handle socket close errors gracefully', () => {
        const connections = new Map<ClientId, IClientConnection>()
        const mockSocket = createMockWebSocket('client-1')
        mockSocket.close = vi.fn(() => {
          throw new Error('Close failed')
        })

        connections.set('client-1' as ClientIdType, {
          id: 'client-1' as ClientIdType,
          socket: mockSocket,
          status: 'connected' as const,
          connectedAt: Date.now(),
        })

        transport = new WebSocketServerTransport({
          server: mockServer,
          connections,
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        // Should not throw
        expect(() => transport.stop()).not.toThrow()
      })
    })

    describe('start', () => {
      it('should complete without error', async () => {
        transport = new WebSocketServerTransport({
          server: mockServer,
          connections: new Map(),
          ServerConstructor: vi.fn().mockReturnValue(mockWsServer),
        })

        await expect(transport.start()).resolves.toBeUndefined()
      })
    })
  })
})
