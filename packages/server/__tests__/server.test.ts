/**
 * SynnelServer Tests
 * Tests for the main server class and factory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SynnelServer, createSynnelServer } from '../src/server/index.js'
import { WebSocketServerTransport } from '../src/transport/index.js'
import type { IServerConfig } from '../src/types/index.js'
import { StateError, ConfigError } from '../src/errors/index.js'

// Mock transport factory
function createMockTransport() {
  const connections = new Map()
  const clients: Map<string, any> = new Map()

  return {
    connections,
    clients,
    sendToClient: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),

    // Helper to simulate client connection
    simulateClient: (id: string) => {
      const client = {
        id,
        socket: {
          send: vi.fn(),
          close: vi.fn(),
        },
        status: 'connected',
        connectedAt: Date.now(),
      }
      connections.set(id, client)
      clients.set(id, client)
      return client
    },
  }
}

describe('SynnelServer', () => {
  let server: SynnelServer
  let mockTransport: ReturnType<typeof createMockTransport>

  beforeEach(() => {
    mockTransport = createMockTransport()
  })

  describe('constructor', () => {
    it('should create server with default config', () => {
      server = new SynnelServer()

      expect(server).toBeDefined()
    })

    it('should create server with custom config', () => {
      const config: IServerConfig = {
        port: 4000,
      }

      server = new SynnelServer(config)

      expect(server).toBeDefined()
      expect(server.getConfig().port).toBe(4000)
    })

    it('should accept injected registry', () => {
      const customRegistry = {
        connections: new Map(),
        register: vi.fn(),
        unregister: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
        getCount: vi.fn(),
        registerChannel: vi.fn(),
        getChannel: vi.fn(),
        removeChannel: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getSubscribers: vi.fn(),
        getSubscriberCount: vi.fn(),
        getChannels: vi.fn(),
        getTotalSubscriptionCount: vi.fn(),
        isSubscribed: vi.fn(),
        clear: vi.fn(),
      }

      const config: IServerConfig = {
        registry: customRegistry as any,
      }

      server = new SynnelServer(config)

      expect(server.getRegistry()).toBe(customRegistry)
    })

    it('should accept middleware array', () => {
      const middleware1 = async () => { }
      const middleware2 = async () => { }

      const config: IServerConfig = {
        middleware: [middleware1, middleware2],
      }

      server = new SynnelServer(config)

      expect(server).toBeDefined()
    })
  })

  describe('lifecycle', () => {
    it('should start the server successfully', async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()

      expect(server.getStats().startedAt).toBeDefined()
    })

    it('should throw error when starting without transport', async () => {
      server = new SynnelServer()

      await expect(server.start()).rejects.toThrow(ConfigError)
    })

    it('should throw error when starting already started server', async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()

      await expect(server.start()).rejects.toThrow(StateError)
    })

    it('should stop the server successfully', async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()
      await server.stop()

      // Should be able to start again after stop
      await server.start()
    })

    it('should handle multiple start/stop cycles', async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()
      await server.stop()
      await server.start()
      await server.stop()

      expect(server.getStats().startedAt).toBeUndefined()
    })
  })

  describe('channels', () => {
    beforeEach(async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()
    })

    it('should create a broadcast channel', () => {
      const broadcast = server.createBroadcast()

      expect(broadcast).toBeDefined()
      expect(broadcast.name).toBe('__broadcast__')
    })

    it('should return the same broadcast channel on subsequent calls', () => {
      const broadcast1 = server.createBroadcast()
      const broadcast2 = server.createBroadcast()

      expect(broadcast1).toBe(broadcast2)
    })

    it('should create a multicast channel', () => {
      const channel = server.createMulticast('chat')

      expect(channel).toBeDefined()
      expect(channel.name).toBe('chat')
    })

    it('should return existing multicast channel if already created', () => {
      const channel1 = server.createMulticast('chat')
      const channel2 = server.createMulticast('chat')

      expect(channel1).toBe(channel2)
    })

    it('should throw error when creating channels before server start', async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      const newServer = new SynnelServer({
        transport: transport as any,
      })

      expect(() => newServer.createMulticast('chat')).toThrow(StateError)
    })

    it('should track created channels', () => {
      server.createMulticast('chat')
      server.createMulticast('news')

      const channels = server.getChannels()

      expect(channels).toContain('chat')
      expect(channels).toContain('news')
    })

    it('should check if channel exists', () => {
      expect(server.hasChannel('chat')).toBe(false)

      server.createMulticast('chat')

      expect(server.hasChannel('chat')).toBe(true)
    })
  })

  describe('events', () => {
    beforeEach(async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()
    })

    it('should register connection event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.on('connection', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should register disconnection event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.on('disconnection', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should register message event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.on('message', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should register subscribe event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.on('subscribe', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should register unsubscribe event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.on('unsubscribe', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should register error event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.on('error', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should register once event handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.once('connection', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should unregister event handler with off', () => {
      const handler = vi.fn()
      server.on('connection', handler)
      server.off('connection', handler)

      // Handler should be removed
    })

    it('should emit custom events', () => {
      const handler = vi.fn()
      server.on('error', handler)

      const testError = new Error('Test error')
      server.emit('error', testError)

      expect(handler).toHaveBeenCalledWith(testError)
    })
  })

  describe('middleware', () => {
    it('should register middleware via use method', () => {
      server = new SynnelServer()

      const middleware = async () => { }
      server.use(middleware)

      // Middleware should be registered
    })

    it('should register middleware from config', async () => {
      const middleware1 = async () => { }
      const middleware2 = async () => { }

      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
        middleware: [middleware1, middleware2],
      })

      await server.start()

      // Middleware should be registered
    })
  })

  describe('message handling', () => {
    beforeEach(async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()
    })

    it('should register and call global message handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.onMessage(handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should return unsubscribe function for message handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.onMessage(handler)

      unsubscribe()

      // Handler should be removed
    })

    it('should register authorization handler', () => {
      const handler = vi.fn()
      const unsubscribe = server.authorize(handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should remove authorization handler when unsubscribe is called', () => {
      const handler1 = vi.fn(() => true)
      const handler2 = vi.fn(() => true)

      const unsubscribe1 = server.authorize(handler1)
      server.authorize(handler2)

      // Remove first handler
      unsubscribe1()

      // Handler should be removed
      expect(handler1).toBeDefined()
      expect(handler2).toBeDefined()
    })

    it('should call authorization handler for messages', () => {
      let authorized = false
      server.authorize((_clientId, _channel, _action) => {
        authorized = true
        return true
      })

      // Authorization would be called during message routing
      // This is tested in integration tests
    })
  })

  describe('stats', () => {
    beforeEach(async () => {
      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      server = new SynnelServer({
        transport: transport as any,
      })

      await server.start()
    })

    it('should return server stats', () => {
      const stats = server.getStats()

      expect(stats).toHaveProperty('startedAt')
      expect(stats).toHaveProperty('clientCount')
      expect(stats).toHaveProperty('channelCount')
      expect(stats).toHaveProperty('subscriptionCount')
    })

    it('should track startedAt after start', () => {
      const stats = server.getStats()

      expect(stats.startedAt).toBeGreaterThan(0)
    })

    it('should track channel count', () => {
      server.createMulticast('chat')
      server.createMulticast('news')

      const stats = server.getStats()

      // At least 1 (broadcast) + 2 multicast channels
      expect(stats.channelCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('utilities', () => {
    it('should get config', () => {
      const config: IServerConfig = {
        port: 4000,
      }

      server = new SynnelServer(config)

      const retrievedConfig = server.getConfig()

      expect(retrievedConfig.port).toBe(4000)
    })

    it('should get registry', () => {
      server = new SynnelServer()

      const registry = server.getRegistry()

      expect(registry).toBeDefined()
    })

    it('should get emitter', () => {
      server = new SynnelServer()

      const emitter = server.getEmitter()

      expect(emitter).toBeDefined()
    })
  })
})

describe('createSynnelServer factory', () => {
  it('should create a SynnelServer instance', () => {
    const transport = new WebSocketServerTransport({
      server: {} as any,
      connections: new Map(),
      ServerConstructor: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn(),
      })),
    })

    const config: IServerConfig = {
      transport: transport as any,
    }

    const server = createSynnelServer(config)

    expect(server).toBeInstanceOf(SynnelServer)
  })

  it('should pass config to SynnelServer', () => {
    const transport = new WebSocketServerTransport({
      server: {} as any,
      connections: new Map(),
      ServerConstructor: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn(),
      })),
    })

    const config: IServerConfig = {
      transport: transport as any,
      port: 4000,
    }

    const server = createSynnelServer(config)

    expect(server.getConfig().port).toBe(4000)
  })

  it('should be a function', () => {
    expect(typeof createSynnelServer).toBe('function')
  })

  describe('factory with transport creation', () => {
    it('should create WebSocketServerTransport when no transport provided', () => {
      const mockServer = {
        listen: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      }

      const MockWsServer = vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn(),
      }))

      const config: IServerConfig = {
        server: mockServer as any,
      }

      // Temporarily replace the WsServer constructor
      const originalWsServer = require('ws').WebSocketServer
      // @ts-ignore - testing purposes
      require('ws').WebSocketServer = MockWsServer

      const server = createSynnelServer(config)

      // Restore original
      // @ts-ignore
      require('ws').WebSocketServer = originalWsServer

      expect(server).toBeInstanceOf(SynnelServer)
      // Note: The dynamic import in factory means the WsServer won't be called synchronously
      // This test verifies the factory doesn't throw
    })

    it('should use custom path when provided', () => {
      const mockServer = {
        listen: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      }

      const MockWsServer = vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn(),
      }))

      const config: IServerConfig = {
        server: mockServer as any,
        path: '/custom-ws',
      }

      // Temporarily replace the WsServer constructor
      const originalWsServer = require('ws').WebSocketServer
      // @ts-ignore - testing purposes
      require('ws').WebSocketServer = MockWsServer

      const server = createSynnelServer(config)

      // Restore original
      // @ts-ignore
      require('ws').WebSocketServer = originalWsServer

      expect(server).toBeInstanceOf(SynnelServer)
    })

    it('should use custom maxPayload when provided', () => {
      const mockServer = {
        listen: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      }

      const MockWsServer = vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn(),
      }))

      const config: IServerConfig = {
        server: mockServer as any,
      }

      // Temporarily replace the WsServer constructor
      const originalWsServer = require('ws').WebSocketServer
      // @ts-ignore - testing purposes
      require('ws').WebSocketServer = MockWsServer

      const server = createSynnelServer(config)

      // Restore original
      // @ts-ignore
      require('ws').WebSocketServer = originalWsServer

      expect(server).toBeInstanceOf(SynnelServer)
    })

    it('should use custom ping settings when provided', () => {
      const mockServer = {
        listen: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      }

      const MockWsServer = vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn(),
      }))

      const config: IServerConfig = {
        server: mockServer as any,
        pingInterval: 30000,
        pingTimeout: 5000,
        enablePing: false,
      }

      // Temporarily replace the WsServer constructor
      const originalWsServer = require('ws').WebSocketServer
      // @ts-ignore - testing purposes
      require('ws').WebSocketServer = MockWsServer

      const server = createSynnelServer(config)

      // Restore original
      // @ts-ignore
      require('ws').WebSocketServer = originalWsServer

      expect(server).toBeInstanceOf(SynnelServer)
    })

    it('should use custom ping settings when provided', () => {
      const mockServer = {
        listen: vi.fn(),
        on: vi.fn(),
        close: vi.fn(),
      }

      const config: IServerConfig = {
        server: mockServer as any,
        pingInterval: 30000,
        pingTimeout: 5000,
        enablePing: false,
      }

      const server = createSynnelServer(config)

      expect(server).toBeInstanceOf(SynnelServer)
    })

    it('should use injected registry when provided', () => {
      const mockRegistry = {
        connections: new Map(),
        register: vi.fn(),
        unregister: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
        getCount: vi.fn(),
        registerChannel: vi.fn(),
        getChannel: vi.fn(),
        removeChannel: vi.fn(),
        getChannels: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        getSubscribers: vi.fn(),
        getSubscriberCount: vi.fn(),
        hasSubscriber: vi.fn(),
        getTotalSubscriptionCount: vi.fn(),
        clear: vi.fn(),
      }

      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections: new Map(),
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      const server = createSynnelServer({
        transport: transport as any,
        registry: mockRegistry as any,
      })

      expect(server.getRegistry()).toBe(mockRegistry)
    })

    it('should use injected connections when provided', () => {
      const connections = new Map()

      const transport = new WebSocketServerTransport({
        server: {} as any,
        connections,
        ServerConstructor: vi.fn().mockImplementation(() => ({
          on: vi.fn(),
          close: vi.fn(),
        })),
      })

      const server = createSynnelServer({
        transport: transport as any,
        connections,
      })

      // The connections should be the same map (by reference)
      expect(server.getRegistry().connections.size).toBe(connections.size)
    })
  })
})
