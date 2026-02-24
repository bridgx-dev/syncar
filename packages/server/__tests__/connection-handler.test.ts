/**
 * ConnectionHandler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConnectionHandler } from '../src/handlers/index.js'
import { ClientRegistry } from '../src/registry/index.js'
import { MiddlewareManager } from '../src/middleware/index.js'
import { EventEmitter } from '../src/emitter/index.js'
import type { IServerTransport, IClientConnection, IServerClient } from '../src/types/index.js'
import { CLOSE_CODES } from '../src/config/index.js'

// Mock transport
class MockTransport implements IServerTransport {
  public connections: Map<string, IClientConnection> = new Map()

  async start(): Promise<void> {}
  stop(): void {}
  get connections(): Map<string, IClientConnection> {
    return this._connections
  }
  private _connections: Map<string, IClientConnection> = new Map()

  sendToClient(): Promise<void> {
    return Promise.resolve(undefined)
  }

  on(): () => void {
    return () => {}
  }

  // Test helper to create a mock connection
  createConnection(id: string): IClientConnection {
    const connection: IClientConnection = {
      id,
      socket: {
        send: vi.fn(),
        close: vi.fn(),
      } as any,
      status: 'connected',
      connectedAt: Date.now(),
      metadata: {},
    }
    this._connections.set(id, connection)
    return connection
  }
}

describe('ConnectionHandler', () => {
  let handler: ConnectionHandler
  let registry: ClientRegistry
  let middleware: MiddlewareManager
  let emitter: EventEmitter
  let transport: MockTransport

  beforeEach(() => {
    registry = new ClientRegistry()
    middleware = new MiddlewareManager()
    emitter = new EventEmitter()
    transport = new MockTransport()

    handler = new ConnectionHandler({
      registry,
      middleware,
      emitter,
      transport,
    })
  })

  describe('handleConnection', () => {
    it('should register a client and emit connection event', async () => {
      const connection = transport.createConnection('client-1')
      const emitSpy = vi.spyOn(emitter, 'emit')

      const client = await handler.handleConnection(connection)

      expect(client.id).toBe('client-1')
      expect(registry.getCount()).toBe(1)
      expect(emitSpy).toHaveBeenCalledWith('connection', client)
    })

    it('should execute connection middleware', async () => {
      const connection = transport.createConnection('client-1')
      const executeSpy = vi.spyOn(middleware, 'executeConnection')

      await handler.handleConnection(connection)

      expect(executeSpy).toHaveBeenCalledWith(expect.anything(), 'connect')
    })

    it('should reject connection when middleware throws', async () => {
      const connection = transport.createConnection('client-1')
      vi.spyOn(middleware, 'executeConnection').mockRejectedValue(new Error('Rejected'))

      await expect(handler.handleConnection(connection)).rejects.toThrow('Connection rejected by middleware')
      expect(registry.getCount()).toBe(0)
    })

    it('should close connection with rejection code when middleware rejects', async () => {
      const connection = transport.createConnection('client-1')
      const closeSpy = vi.spyOn(connection.socket, 'close')
      vi.spyOn(middleware, 'executeConnection').mockRejectedValue(new Error('Rejected'))

      try {
        await handler.handleConnection(connection)
      } catch {
        // Expected
      }

      expect(closeSpy).toHaveBeenCalledWith(CLOSE_CODES.REJECTED, 'Connection rejected')
    })

    it('should not emit connection event when emitConnectionEvent is false', async () => {
      const connection = transport.createConnection('client-1')
      const emitSpy = vi.spyOn(emitter, 'emit')

      handler = new ConnectionHandler({
        registry,
        middleware,
        emitter,
        transport,
        options: { emitConnectionEvent: false },
      })

      await handler.handleConnection(connection)

      expect(emitSpy).not.toHaveBeenCalledWith('connection', expect.anything())
    })
  })

  describe('handleDisconnection', () => {
    beforeEach(async () => {
      const connection = transport.createConnection('client-1')
      await handler.handleConnection(connection)
    })

    it('should unregister client and emit disconnection event', async () => {
      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleDisconnection('client-1')

      expect(registry.getCount()).toBe(0)
      expect(emitSpy).toHaveBeenCalledWith('disconnection', expect.anything())
    })

    it('should emit disconnection event BEFORE unregistering', async () => {
      const emitSpy = vi.spyOn(emitter, 'emit')
      const calls: string[] = []

      emitSpy.mockImplementation((event, client) => {
        if (event === 'disconnection') {
          // Client should still be in registry when event is emitted
          calls.push(`before-${registry.getCount()}`)
        }
      })

      await handler.handleDisconnection('client-1')

      // Client should still exist when event is fired
      expect(calls).toEqual(['before-1'])
    })

    it('should execute disconnect middleware', async () => {
      const executeSpy = vi.spyOn(middleware, 'executeConnection')

      await handler.handleDisconnection('client-1')

      expect(executeSpy).toHaveBeenCalledWith(expect.anything(), 'disconnect')
    })

    it('should ignore middleware errors during disconnection', async () => {
      const emitSpy = vi.spyOn(emitter, 'emit')
      vi.spyOn(middleware, 'executeConnection').mockRejectedValue(new Error('Middleware error'))

      await expect(handler.handleDisconnection('client-1')).resolves.not.toThrow()
      expect(emitSpy).toHaveBeenCalledWith('disconnection', expect.anything())
    })

    it('should return early if client not found', async () => {
      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleDisconnection('non-existent')

      expect(emitSpy).not.toHaveBeenCalled()
    })

    it('should not emit disconnection event when emitDisconnectionEvent is false', async () => {
      handler = new ConnectionHandler({
        registry,
        middleware,
        emitter,
        transport,
        options: { emitDisconnectionEvent: false },
      })

      const emitSpy = vi.spyOn(emitter, 'emit')

      await handler.handleDisconnection('client-1')

      expect(emitSpy).not.toHaveBeenCalledWith('disconnection', expect.anything())
    })
  })

  describe('getOptions', () => {
    it('should return default options', () => {
      const options = handler.getOptions()

      expect(options.emitConnectionEvent).toBe(true)
      expect(options.emitDisconnectionEvent).toBe(true)
      expect(options.rejectionCloseCode).toBe(CLOSE_CODES.REJECTED)
    })

    it('should return custom options', () => {
      handler = new ConnectionHandler({
        registry,
        middleware,
        emitter,
        transport,
        options: {
          emitConnectionEvent: false,
          emitDisconnectionEvent: false,
          rejectionCloseCode: 4000,
        },
      })

      const options = handler.getOptions()

      expect(options.emitConnectionEvent).toBe(false)
      expect(options.emitDisconnectionEvent).toBe(false)
      expect(options.rejectionCloseCode).toBe(4000)
    })
  })
})
