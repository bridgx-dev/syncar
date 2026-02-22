/**
 * WebSocket Server Transport Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketServerTransport } from '../server.js'
import type { ServerTransportConfig } from '../types.js'
import type { Message } from '@synnel/core'
import { MessageType } from '@synnel/core'

// Mock WebSocket Client
class MockClientWebSocket {
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState: number = MockClientWebSocket.OPEN
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: ((event: Error) => void) | null = null
  onpong: (() => void) | null = null

  private sentMessages: string[] = []
  private messageHandlers: ((data: Buffer) => void)[] = []
  private closeHandlers: ((code: number, reason: Buffer) => void)[] = []

  send(data: string): void {
    this.sentMessages.push(data)
  }

  ping(): void {
    queueMicrotask(() => {
      if (this.onpong) {
        this.onpong()
      }
    })
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockClientWebSocket.CLOSING
    queueMicrotask(() => {
      this.readyState = MockClientWebSocket.CLOSED
      if (this.onclose) {
        this.onclose({ code: code ?? 1000, reason: reason ?? '' })
      }
      // Also call the handlers registered via ws.on('close')
      for (const handler of this.closeHandlers) {
        handler(code ?? 1000, Buffer.from(reason ?? ''))
      }
    })
  }

  terminate(): void {
    this.readyState = MockClientWebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ code: 1006, reason: 'Terminated' })
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (event === 'message') {
      this.messageHandlers.push(callback)
    } else if (event === 'close') {
      this.closeHandlers.push(callback)
    }
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) })
    }
  }

  // Simulate receiving a raw message (Buffer) as the server would send
  simulateRawMessage(data: Buffer): void {
    for (const handler of this.messageHandlers) {
      handler(data)
    }
  }

  getLastSentMessage(): string | undefined {
    return this.sentMessages[this.sentMessages.length - 1]
  }
}

// Mock WebSocket Server
class MockWebSocketServer {
  port: number
  host: string
  path: string
  maxPayload: number
  server?: any // For attached mode

  private listeners: Map<string, Set<Function>> = new Map()
  private clients: MockClientWebSocket[] = []

  constructor(options: any) {
    this.port = options.port
    this.host = options.host
    this.path = options.path
    this.maxPayload = options.maxPayload
    this.server = options.server
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }

  close(callback?: (err?: Error) => void): void {
    for (const client of this.clients) {
      client.terminate()
    }
    this.clients = []

    queueMicrotask(() => {
      callback?.()
    })
  }

  // Test helpers
  simulateClientConnection(ws: MockClientWebSocket): void {
    this.clients.push(ws)
    this.emit('connection', ws)
  }

  triggerListening(): void {
    this.emit('listening')
  }

  triggerError(error: Error): void {
    this.emit('error', error)
  }

  address(): { port: number } {
    return { port: this.port }
  }
}

describe('WebSocketServerTransport', () => {
  describe('constructor', () => {
    it('should initialize with default config', () => {
      const server = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: MockWebSocketServer as any,
      })

      const info = server.getServerInfo()
      expect(info.path).toBe('/synnel')
      expect(info.port).toBeUndefined()
    })

    it('should accept custom config', () => {
      const customServer = new WebSocketServerTransport({
        port: 4000,
        host: '127.0.0.1',
        path: '/custom',
        enablePing: false,
        ServerConstructor: MockWebSocketServer as any,
      })

      const info = customServer.getServerInfo()
      expect(info.path).toBe('/custom')
      expect(info.port).toBeUndefined()
    })
  })

  describe('start', () => {
    it('should start the server', async () => {
      const listeningHandler = vi.fn()

      const mockServers: MockWebSocketServer[] = []

      const server = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServers.push(this)
            // Automatically trigger listening
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })

      server.on('listening', listeningHandler)

      await server.start()

      expect(server.getServerInfo().startedAt).toBeDefined()
      expect(listeningHandler).toHaveBeenCalledWith(3000)
    })

    it('should handle server errors', async () => {
      const errorHandler = vi.fn()

      const server = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            // Automatically trigger error
            queueMicrotask(() => this.triggerError(new Error('Port in use')))
          }
        } as any,
      })

      server.on('error', errorHandler)

      await expect(server.start()).rejects.toThrow()
      expect(errorHandler).toHaveBeenCalled()
    })

    it('should throw if already started', async () => {
      const server = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })

      await server.start()

      await expect(server.start()).rejects.toThrow('Server is already running')
    })
  })

  describe('client connection', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(async () => {
      const createdServer = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })
      server = createdServer

      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should handle new client connection', () => {
      const connectionHandler = vi.fn()
      server.on('connection', connectionHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      expect(server.getClients()).toHaveLength(1)
      expect(connectionHandler).toHaveBeenCalled()

      const clientId = connectionHandler.mock.calls[0][0]
      expect(typeof clientId).toBe('string')
    })

    it('should track client info', () => {
      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clients = server.getClients()
      expect(clients).toHaveLength(1)

      const client = clients[0]
      expect(client.id).toBeDefined()
      expect(client.status).toBe('connected')
      expect(client.connectedAt).toBeDefined()
      expect(client.connectedAt).toBeGreaterThan(0)
    })

    it('should handle client disconnection', async () => {
      const disconnectionHandler = vi.fn()
      server.on('disconnection', disconnectionHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id

      clientWs.close(1000, 'Normal close')

      // Wait for close to process
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(server.getClients()).toHaveLength(0)
      expect(disconnectionHandler).toHaveBeenCalledWith(clientId, {
        wasClean: true,
        code: 1000,
        reason: 'Normal close',
      })
    })
  })

  describe('sendToClient', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(async () => {
      const createdServer = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })
      server = createdServer

      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should send message to specific client', async () => {
      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id

      const message: Message = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'test',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      await server.sendToClient(clientId, message)

      const sentData = clientWs.getLastSentMessage()
      expect(sentData).toBeDefined()

      const parsed = JSON.parse(sentData!)
      expect(parsed).toEqual(message)
    })

    it('should throw if client not found', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'test',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }

      await expect(server.sendToClient('nonexistent', message)).rejects.toThrow('Client not found')
    })
  })

  describe('broadcast', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(async () => {
      const createdServer = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })
      server = createdServer

      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should broadcast message to all clients', async () => {
      const client1 = new MockClientWebSocket()
      const client2 = new MockClientWebSocket()
      const client3 = new MockClientWebSocket()

      mockServer.simulateClientConnection(client1)
      mockServer.simulateClientConnection(client2)
      mockServer.simulateClientConnection(client3)

      const message: Message = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'broadcast',
        data: { text: 'hello all' },
        timestamp: Date.now(),
      }

      await server.broadcast(message)

      expect(client1.getLastSentMessage()).toBeDefined()
      expect(client2.getLastSentMessage()).toBeDefined()
      expect(client3.getLastSentMessage()).toBeDefined()

      expect(JSON.parse(client1.getLastSentMessage()!)).toEqual(message)
      expect(JSON.parse(client2.getLastSentMessage()!)).toEqual(message)
      expect(JSON.parse(client3.getLastSentMessage()!)).toEqual(message)
    })
  })

  describe('disconnectClient', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(async () => {
      const createdServer = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })
      server = createdServer

      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should disconnect specific client', async () => {
      const disconnectionHandler = vi.fn()
      server.on('disconnection', disconnectionHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id

      await server.disconnectClient(clientId, 1000, 'Server disconnect')

      // Wait for close to process
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(server.getClients()).toHaveLength(0)
      expect(disconnectionHandler).toHaveBeenCalledWith(clientId, {
        wasClean: true,
        code: 1000,
        reason: 'Server disconnect',
      })
    })

    it('should throw if client not found', async () => {
      await expect(server.disconnectClient('nonexistent')).rejects.toThrow('Client not found')
    })
  })

  describe('message handling', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(async () => {
      const createdServer = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })
      server = createdServer

      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should receive and parse messages from clients', () => {
      const messageHandler = vi.fn()
      server.on('message', messageHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id

      const message: Message = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'test',
        data: { text: 'hello from client' },
        timestamp: Date.now(),
      }

      // Use the raw message simulation (Buffer) as the server expects
      clientWs.simulateRawMessage(Buffer.from(JSON.stringify(message)))

      expect(messageHandler).toHaveBeenCalledWith(clientId, message)
    })

    it('should emit error on invalid message', () => {
      const errorHandler = vi.fn()
      server.on('error', errorHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      clientWs.simulateRawMessage(Buffer.from('invalid json'))

      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('getClient', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(async () => {
      const createdServer = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })
      server = createdServer

      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should return client by ID', () => {
      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id
      const client = server.getClient(clientId)

      expect(client).toBeDefined()
      expect(client?.id).toBe(clientId)
    })

    it('should return undefined for nonexistent client', () => {
      const client = server.getClient('nonexistent')
      expect(client).toBeUndefined()
    })
  })

  describe('stop', () => {
    it('should stop the server and close all connections', async () => {
      let mockServer: MockWebSocketServer

      const server = new WebSocketServerTransport({
        port: 3000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })

      await server.start()

      const client1 = new MockClientWebSocket()
      const client2 = new MockClientWebSocket()
      mockServer.simulateClientConnection(client1)
      mockServer.simulateClientConnection(client2)

      await server.stop()

      expect(server.getClients()).toHaveLength(0)
    })
  })

  describe('getServerInfo', () => {
    it('should return server info after start', async () => {
      const server = new WebSocketServerTransport({
        port: 4000,
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            queueMicrotask(() => this.triggerListening())
          }
        } as any,
      })

      await server.start()

      const info = server.getServerInfo()

      expect(info.mode).toBe('standalone')
      expect(info.port).toBe(4000)
      expect(info.path).toBe('/synnel')
      expect(info.startedAt).toBeDefined()

      await server.stop()
    })
  })
})
