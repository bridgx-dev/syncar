/**
 * WebSocket Server Transport Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketServerTransport } from '../server.js'
import type { ServerTransportConfig } from '../types.js'
import type { Message } from '@synnel/core'
import { MessageType } from '@synnel/core'
import type { IncomingMessage } from 'node:http'

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
  server?: any

  private listeners: Map<string, Set<Function>> = new Map()
  private clientsMap: Set<MockClientWebSocket> = new Set()

  get clients() {
    return this.clientsMap
  }

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
    for (const client of this.clientsMap) {
      client.terminate()
    }
    this.clientsMap.clear()

    // Simulate close event emission
    this.emit('close')

    queueMicrotask(() => {
      callback?.()
    })
  }

  simulateClientConnection(ws: MockClientWebSocket): void {
    this.clientsMap.add(ws)
    this.emit('connection', ws)
  }
}

describe('WebSocketServerTransport', () => {
  describe('constructor', () => {
    it('should initialize with default config', () => {
      const server = new WebSocketServerTransport({
        server: {},
        ServerConstructor: MockWebSocketServer as any,
      })

      const info = server.getServerInfo()
      expect(info.path).toBe('/')
      expect(info.startedAt).toBeDefined()
    })

    it('should accept custom config', () => {
      const customServer = new WebSocketServerTransport({
        server: {},
        path: '/custom',
        enablePing: false,
        ServerConstructor: MockWebSocketServer as any,
      })

      const info = customServer.getServerInfo()
      expect(info.path).toBe('/custom')
    })
  })

  describe('client connection', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(() => {
      server = new WebSocketServerTransport({
        server: {},
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
          }
        } as any,
      })
    })

    it('should handle new client connection', () => {
      const connectionHandler = vi.fn()
      server.on('connection', connectionHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      expect(server.getClients()).toHaveLength(1)
      expect(connectionHandler).toHaveBeenCalled()
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
    })

    it('should handle client disconnection safely', async () => {
      const disconnectionHandler = vi.fn()
      server.on('disconnection', disconnectionHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id

      clientWs.close(1000, 'Normal close')

      // Wait for close to process
      await new Promise((resolve) => setTimeout(resolve, 10))

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

    beforeEach(() => {
      server = new WebSocketServerTransport({
        server: {},
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
          }
        } as any,
      })
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
      expect(JSON.parse(sentData!)).toEqual(message)
    })

    it('should throw if client not found', async () => {
      const message: Message = {
        id: 'msg-1',
        type: MessageType.DATA,
        channel: 'test',
        data: { text: 'hello' },
        timestamp: Date.now(),
      }
      await expect(server.sendToClient('nonexistent', message)).rejects.toThrow(
        'Client not found',
      )
    })
  })

  describe('disconnectClient', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(() => {
      server = new WebSocketServerTransport({
        server: {},
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
          }
        } as any,
      })
    })

    it('should disconnect specific client', async () => {
      const disconnectionHandler = vi.fn()
      server.on('disconnection', disconnectionHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      const clientId = server.getClients()[0].id

      await server.disconnectClient(clientId, 1000, 'Server disconnect')

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(server.getClients()).toHaveLength(0)
      expect(disconnectionHandler).toHaveBeenCalledWith(clientId, {
        wasClean: true,
        code: 1000,
        reason: 'Server disconnect',
      })
    })

    it('should throw if client not found', async () => {
      await expect(server.disconnectClient('nonexistent')).rejects.toThrow(
        'Client not found',
      )
    })
  })

  describe('message handling', () => {
    let server: WebSocketServerTransport
    let mockServer: MockWebSocketServer

    beforeEach(() => {
      server = new WebSocketServerTransport({
        server: {},
        ServerConstructor: class extends MockWebSocketServer {
          constructor(...args: any[]) {
            super(...args)
            mockServer = this
          }
        } as any,
      })
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

      clientWs.simulateRawMessage(Buffer.from(JSON.stringify(message)))

      expect(messageHandler).toHaveBeenCalledWith(clientId, message)
    })

    it('should elegantly reject invalid messages', () => {
      const errorHandler = vi.fn()
      server.on('error', errorHandler)

      const clientWs = new MockClientWebSocket()
      mockServer.simulateClientConnection(clientWs)

      clientWs.simulateRawMessage(Buffer.from('invalid json'))

      expect(errorHandler).toHaveBeenCalled()
    })
  })
})
