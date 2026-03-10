/**
 * Unit tests for server.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SyncarServer,
  createSyncarServer,
  type IServerOptions,
  type IServerStats,
} from '../src/server'
import { ClientRegistry } from '../src/registry'
import { BroadcastChannel, MulticastChannel } from '../src/channel'
import { WebSocketServerTransport } from '../src/websocket'
import { StateError, ValidationError } from '../src/errors'
import { ContextManager } from '../src/context'
import { createDefaultLogger } from '../src/utils'
import type { IClientConnection } from '../src/types'
import { WebSocket } from 'ws'
import { createMockClient } from './setup'

// Mock WebSocket class for testing
class MockWebSocket {
  public readyState = 1 // OPEN
  public sent: string[] = []

  send(data: string, _callback?: () => void) {
    this.sent.push(data)
  }

  close(_code?: number, _reason?: string) {
    this.readyState = 3 // CLOSED
  }

  ping() {
    // Mock ping
  }
}

describe('SyncarServer', () => {
  let registry: ClientRegistry
  let transport: WebSocketServerTransport
  let mockHttpServer: any

  beforeEach(() => {
    registry = new ClientRegistry()

    // Create a mock HTTP server
    mockHttpServer = {
      listen: vi.fn((port, host, callback) => {
        if (callback) callback()
      }),
      close: vi.fn((callback) => {
        if (callback) callback()
      }),
      on: vi.fn(),
    }

    // Create a real transport with mock server
    transport = new WebSocketServerTransport({
      server: mockHttpServer,
      path: '/test',
      enablePing: false,
      connections: registry.connections,
      logger: createDefaultLogger(),
    })
  })

  describe('constructor', () => {
    it('should create server with required config', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)

      expect(server).toBeInstanceOf(SyncarServer)
      expect(server.registry).toBe(registry)
      expect(server.getStats().clientCount).toBe(0)
    })

    it('should register middleware from config', () => {
      const middleware = vi.fn(async (_ctx, next) => next())

      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [middleware],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      server.use(middleware)
      expect(server).toBeInstanceOf(SyncarServer)
    })
  })

  describe('start()', () => {
    it('should start the server successfully', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const stats = server.getStats()
      expect(stats.startedAt).toBeDefined()
      expect(stats.startedAt).toBeGreaterThan(0)
    })

    it('should throw StateError when already started', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      await expect(server.start()).rejects.toThrow(StateError)
      await expect(server.start()).rejects.toThrow('Server is already started')
    })

    it('should create broadcast channel on start', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const broadcast = server.createBroadcast<string>()
      expect(broadcast).toBeInstanceOf(BroadcastChannel)
      expect(broadcast.name).toBe('__broadcast__')
    })
  })

  describe('stop()', () => {
    it('should stop the server successfully', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()
      await server.stop()

      // Should be able to stop again without error
      await server.stop()
    })

    it('should clear channels on stop', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      // Create a channel
      server.createMulticast('chat')
      expect(server.hasChannel('chat')).toBe(true)

      // Stop and verify channels are cleared
      await server.stop()
      expect(server.getChannels()).toHaveLength(0)
    })
  })

  describe('createBroadcast()', () => {
    it('should return broadcast channel after start', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const broadcast = server.createBroadcast<string>()
      expect(broadcast).toBeInstanceOf(BroadcastChannel)
      expect(broadcast.name).toBe('__broadcast__')
    })

    it('should throw StateError when server not started', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)

      expect(() => server.createBroadcast()).toThrow(StateError)
      expect(() => server.createBroadcast()).toThrow('Server must be started before creating channels')
    })

    it('should return same broadcast channel instance', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const broadcast1 = server.createBroadcast<string>()
      const broadcast2 = server.createBroadcast<number>()

      expect(broadcast1).toBe(broadcast2)
    })
  })

  describe('createMulticast()', () => {
    it('should create a new multicast channel', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const chat = server.createMulticast<{ text: string }>('chat')
      expect(chat).toBeInstanceOf(MulticastChannel)
      expect(chat.name).toBe('chat')
    })

    it('should throw StateError when server not started', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)

      expect(() => server.createMulticast('chat')).toThrow(StateError)
    })

    it('should throw ValidationError for reserved channel names', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      // __private__ starts with __ which is reserved
      expect(() => server.createMulticast('__private__')).toThrow(Error)
    })

    it('should return existing channel if already created', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const chat1 = server.createMulticast('chat')
      const chat2 = server.createMulticast('chat')

      expect(chat1).toBe(chat2)
    })
  })

  describe('hasChannel()', () => {
    it('should return false for non-existent channel', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      expect(server.hasChannel('chat')).toBe(false)
    })

    it('should return true for existing channel', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      server.createMulticast('chat')
      expect(server.hasChannel('chat')).toBe(true)
    })
  })

  describe('getChannels()', () => {
    it('should return empty array when no channels', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      expect(server.getChannels()).toEqual([])
    })

    it('should return all channel names', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      server.createMulticast('chat')
      server.createMulticast('notifications')
      server.createMulticast('presence')

      const channels = server.getChannels()
      // Includes the broadcast channel + our 3 channels
      expect(channels).toContain('__broadcast__')
      expect(channels).toContain('chat')
      expect(channels).toContain('notifications')
      expect(channels).toContain('presence')
      expect(channels).toHaveLength(4)
    })
  })

  describe('use()', () => {
    it('should register global middleware', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      const middleware = vi.fn(async (_ctx, next) => next())

      server.use(middleware)

      // No direct way to verify, but should not throw
      expect(server).toBeInstanceOf(SyncarServer)
    })
  })

  describe('authenticate()', () => {
    it('should set authenticator on transport', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const authenticator = vi.fn(async (request) => {
        return 'user-' + request.headers['user-id']
      })

      server.authenticate(authenticator)

      // Should not throw - authenticator is set on transport
      expect(server).toBeInstanceOf(SyncarServer)
    })
  })

  describe('getStats()', () => {
    it('should return server statistics', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)

      const stats = server.getStats()
      expect(stats.clientCount).toBe(0)
      expect(stats.channelCount).toBe(0)
      expect(stats.subscriptionCount).toBe(0)
      expect(stats.startedAt).toBeUndefined()

      await server.start()

      const startedStats = server.getStats()
      expect(startedStats.startedAt).toBeDefined()
      expect(startedStats.startedAt).toBeGreaterThan(0)
    })

    it('should reflect client count correctly', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      // Add a mock client
      const client: IClientConnection = {
        id: 'client-1',
        connectedAt: Date.now(),
        socket: new MockWebSocket() as any,
      }
      registry.register(client)

      const stats = server.getStats()
      expect(stats.clientCount).toBe(1)
    })
  })

  describe('getConfig()', () => {
    it('should return readonly config', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      const retrievedConfig = server.getConfig()

      expect(retrievedConfig.port).toBe(3000)
      expect(retrievedConfig.host).toBe('0.0.0.0')
      expect(retrievedConfig.path).toBe('/syncar')
    })
  })

  describe('getRegistry()', () => {
    it('should return the client registry', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      const retrievedRegistry = server.getRegistry()

      expect(retrievedRegistry).toBe(registry)
    })
  })
})

describe('createSyncarServer', () => {
  let mockHttpServer: any

  beforeEach(() => {
    // Create a mock HTTP server for each test
    mockHttpServer = {
      listen: vi.fn((port, host, callback) => {
        if (callback) callback()
      }),
      close: vi.fn((callback) => {
        if (callback) callback()
      }),
      on: vi.fn(),
    }
  })

  it('should create server with defaults and mock server', () => {
    const server = createSyncarServer({
      server: mockHttpServer,
    })

    expect(server).toBeInstanceOf(SyncarServer)
    expect(server.getRegistry()).toBeInstanceOf(ClientRegistry)
  })

  it('should merge provided config with defaults', () => {
    const server = createSyncarServer({
      server: mockHttpServer,
      port: 8080,
      host: 'localhost',
    })

    const config = server.getConfig()
    expect(config.port).toBe(8080)
    expect(config.host).toBe('localhost')
  })

  it('should use provided registry', () => {
    const customRegistry = new ClientRegistry()
    const server = createSyncarServer({
      server: mockHttpServer,
      registry: customRegistry,
    })

    expect(server.getRegistry()).toBe(customRegistry)
  })

  it('should use provided logger', () => {
    const customLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    const server = createSyncarServer({
      server: mockHttpServer,
      logger: customLogger as any,
    })

    expect(server.getConfig().logger).toBe(customLogger)
  })

  it('should create WebSocketServerTransport when not provided', () => {
    const server = createSyncarServer({
      server: mockHttpServer,
    })

    const config = server.getConfig()
    expect(config.transport).toBeInstanceOf(WebSocketServerTransport)
  })

  it('should use provided transport', () => {
    const registry = new ClientRegistry()

    const customTransport = new WebSocketServerTransport({
      server: mockHttpServer,
      path: '/custom',
      enablePing: false,
      connections: registry.connections,
      logger: createDefaultLogger(),
    })

    const server = createSyncarServer({
      transport: customTransport,
    })

    expect(server.getConfig().transport).toBe(customTransport)
  })

  it('should register middleware from config', () => {
    const middleware = vi.fn(async (_ctx, next) => next())

    const server = createSyncarServer({
      server: mockHttpServer,
      middleware: [middleware],
    })

    // Middleware should be registered via context
    expect(server).toBeInstanceOf(SyncarServer)
  })
})

describe('SyncarServer.createChannel', () => {
  let registry: ClientRegistry
  let transport: WebSocketServerTransport
  let mockHttpServer: any

  beforeEach(() => {
    registry = new ClientRegistry()

    // Create a mock HTTP server
    mockHttpServer = {
      listen: vi.fn((port, host, callback) => {
        if (callback) callback()
      }),
      close: vi.fn((callback) => {
        if (callback) callback()
      }),
      on: vi.fn(),
    }

    // Create a real transport with mock server
    transport = new WebSocketServerTransport({
      server: mockHttpServer,
      path: '/test',
      enablePing: false,
      connections: registry.connections,
      logger: createDefaultLogger(),
    })
  })

  describe('createChannel', () => {
    it('should create a channel with default options', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const channel = server.createChannel('chat')

      expect(channel.name).toBe('chat')
      expect(channel.scope).toBe('subscribers')
      expect(channel.flow).toBe('bidirectional')
    })

    it('should create a broadcast channel', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const channel = server.createChannel('alerts', { scope: 'broadcast' })

      // Broadcast scope returns the BroadcastChannel instance
      expect(channel.name).toBe('__broadcast__')
      expect(channel).toBeInstanceOf(BroadcastChannel)
    })

    it('should create a send-only subscriber channel', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const channel = server.createChannel('updates', { flow: 'send-only' })

      expect(channel.scope).toBe('subscribers')
      expect(channel.flow).toBe('send-only')
    })

    it('should return existing channel if already created', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const channel1 = server.createChannel('chat')
      const channel2 = server.createChannel('chat')

      expect(channel1).toBe(channel2)
    })

    it('should throw if server not started', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)

      expect(() => server.createChannel('chat')).toThrow('Server must be started')
    })
  })

  describe('broadcast', () => {
    it('should broadcast to all clients', async () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)
      await server.start()

      const mockClients = [
        createMockClient('client-1'),
        createMockClient('client-2'),
      ]

      for (const client of mockClients) {
        server.getRegistry().register(client)
      }

      // Should not throw
      expect(() => server.broadcast('Hello everyone')).not.toThrow()
    })

    it('should throw if server not started', () => {
      const config: IServerOptions = {
        registry,
        logger: createDefaultLogger(),
        port: 3000,
        host: '0.0.0.0',
        path: '/syncar',
        transport,
        enablePing: false,
        pingInterval: 30000,
        pingTimeout: 5000,
        middleware: [],
        broadcastChunkSize: 500,
      }

      const server = new SyncarServer(config)

      expect(() => server.broadcast('test')).toThrow('Server must be started')
    })
  })
})
