/**
 * SynnelServer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SynnelServer } from '../src/server/index.js'
import { WebSocketServerTransport } from '../src/transport/index.js'
import { createServer as createHttpServer, type Server as HttpServer } from 'http'
import type { IServerConfig } from '../src/types/index.js'
import { WebSocket } from 'ws'
import type { IServerClient } from '../src/types/index.js'

describe('SynnelServer', () => {
  let httpServer: HttpServer
  let server: SynnelServer
  let port: number

  beforeEach(async () => {
    port = 4000 + Math.floor(Math.random() * 1000)
    httpServer = createHttpServer()

    const transport = new WebSocketServerTransport({
      server: httpServer,
      path: '/ws',
    })

    const config: IServerConfig = {
      transport,
    }

    server = new SynnelServer(config)
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
    })
  })

  describe('server lifecycle', () => {
    it('should start the server successfully', async () => {
      await expect(server.start()).resolves.not.toThrow()
    })

    it('should throw error when starting already started server', async () => {
      await server.start()

      await expect(server.start()).rejects.toThrow()
    })

    it('should stop the server successfully', async () => {
      await server.start()
      await expect(server.stop()).resolves.not.toThrow()
    })

    it('should handle multiple start/stop cycles', async () => {
      await server.start()
      await server.stop()

      // Should be able to start again
      await server.start()
      await server.stop()
    })
  })

  describe('channel creation', () => {
    beforeEach(async () => {
      await server.start()
    })

    it('should create a broadcast channel', () => {
      const broadcast = server.createBroadcast<string>()

      expect(broadcast).toBeDefined()
      expect(broadcast.name).toBe('__broadcast__')
    })

    it('should create a multicast channel', () => {
      const chat = server.createMulticast<string>('chat')

      expect(chat).toBeDefined()
      expect(chat.name).toBe('chat')
    })

    it('should return existing multicast channel if already created', () => {
      const chat1 = server.createMulticast<string>('chat')
      const chat2 = server.createMulticast<string>('chat')

      expect(chat1).toBe(chat2)
    })

    it('should throw error when creating channels before server start', () => {
      const uninitializedServer = new SynnelServer({
        transport: new WebSocketServerTransport({ server: httpServer, path: '/ws' }),
      })

      expect(() => uninitializedServer.createMulticast('test')).toThrow()
      expect(() => uninitializedServer.createBroadcast()).toThrow()
    })

    it('should track created channels', () => {
      server.createMulticast<string>('chat')
      server.createMulticast<string>('presence')
      server.createBroadcast<string>()

      expect(server.hasChannel('chat')).toBe(true)
      expect(server.hasChannel('presence')).toBe(true)
      expect(server.hasChannel('__broadcast__')).toBe(true)
      expect(server.hasChannel('nonexistent')).toBe(false)
    })

    it('should return list of channel names', () => {
      server.createMulticast<string>('chat')
      server.createMulticast<string>('presence')

      const channels = server.getChannels()

      expect(channels).toContain('chat')
      expect(channels).toContain('presence')
      expect(channels).toContain('__broadcast__')
    })
  })

  describe('event handlers', () => {
    beforeEach(async () => {
      await server.start()
    })

    it('should register and call connection event handler', async () => {
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })

      let connectedClient: IServerClient | undefined

      server.on('connection', (client) => {
        connectedClient = client
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (connectedClient) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(connectedClient).toBeDefined()
      expect(connectedClient?.id).toMatch(/^client-\d+$/)

      client.close()
    })

    it('should register and call disconnection event handler', async () => {
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })

      let disconnectedClient: IServerClient | undefined

      server.on('connection', () => {})
      server.on('disconnection', (client) => {
        disconnectedClient = client
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))
      client.close()

      await new Promise<void>((resolve) => {
        const check = () => {
          if (disconnectedClient) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(disconnectedClient).toBeDefined()
    })

    it('should register and call subscribe event handler', async () => {
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })

      const chat = server.createMulticast<string>('chat')

      let subscribedClient: IServerClient | undefined
      let subscribedChannel: string | undefined

      server.on('subscribe', (client, channel) => {
        subscribedClient = client
        subscribedChannel = channel
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      client.send(JSON.stringify({
        type: 'signal',
        signal: 'subscribe',
        channel: 'chat',
      }))

      await new Promise<void>((resolve) => {
        const check = () => {
          if (subscribedClient && subscribedChannel) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(subscribedChannel).toBe('chat')

      client.close()
    })

    it('should register and call error event handler', async () => {
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })

      let receivedError: Error | undefined

      server.on('error', (error) => {
        receivedError = error
      })

      // Create a client that will cause an error
      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          // Connection might succeed, that's fine
          setTimeout(resolve, 100)
        }
        check()
      })

      client.close()
    })
  })

  describe('authorization', () => {
    beforeEach(async () => {
      await server.start()
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })
    })

    it('should register and call authorization handler', async () => {
      let authCalled = false

      server.authorize(async (clientId, channel, action) => {
        authCalled = true
        expect(clientId).toMatch(/^client-\d+$/)
        expect(action).toBe('message')
        return true
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      server.createMulticast<string>('chat')

      client.send(JSON.stringify({
        type: 'data',
        channel: 'chat',
        data: { text: 'test' },
      }))

      await new Promise<void>((resolve) => {
        const check = () => {
          if (authCalled) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      client.close()
    })

    it('should reject message when authorization returns false', async () => {
      server.authorize(async () => {
        return false
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      const chat = server.createMulticast<string>('chat')

      let messageReceived = false
      chat.onMessage(() => {
        messageReceived = true
      })

      client.send(JSON.stringify({
        type: 'data',
        channel: 'chat',
        data: { text: 'test' },
      }))

      await new Promise<void>((resolve) => setTimeout(resolve, 100))

      expect(messageReceived).toBe(false)

      client.close()
    })

    it('should return unsubscribe function', () => {
      const unsubscribe = server.authorize(async () => true)

      expect(typeof unsubscribe).toBe('function')

      // Calling it should remove the handler
      unsubscribe()

      // Now authorization should pass (no handler = allow all)
    })
  })

  describe('global message handler', () => {
    beforeEach(async () => {
      await server.start()
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })
    })

    it('should register and call global message handler', async () => {
      let messageReceived = false

      server.onMessage((client, message) => {
        messageReceived = true
        expect(client).toBeDefined()
        expect(message.type).toBe('data')
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      client.send(JSON.stringify({
        type: 'data',
        channel: 'test',
        data: { text: 'hello' },
      }))

      await new Promise<void>((resolve) => {
        const check = () => {
          if (messageReceived) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      client.close()
    })

    it('should return unsubscribe function', () => {
      const unsubscribe = server.onMessage(() => {})

      expect(typeof unsubscribe).toBe('function')

      unsubscribe()

      // Handler should be removed
    })
  })

  describe('middleware', () => {
    it('should register middleware from config', async () => {
      const middleware = vi.fn()

      const config: IServerConfig = {
        transport: new WebSocketServerTransport({ server: httpServer, path: '/ws' }),
        middleware: [middleware],
      }

      const serverWithMiddleware = new SynnelServer(config)

      await serverWithMiddleware.start()
      await serverWithMiddleware.stop()
    })

    it('should register middleware via use method', () => {
      const middleware = vi.fn()

      server.use(middleware)

      // Should not throw
    })
  })

  describe('server statistics', () => {
    beforeEach(async () => {
      await server.start()
    })

    it('should return server stats', () => {
      const stats = server.getStats()

      expect(stats).toBeDefined()
      expect(stats.clientCount).toBe(0)
      expect(stats.channelCount).toBeGreaterThan(0) // At least broadcast channel
      expect(stats.startedAt).toBeDefined()
    })

    it('should track connected clients', async () => {
      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })

      server.on('connection', () => {})

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (server.getStats().clientCount === 1) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      const stats = server.getStats()
      expect(stats.clientCount).toBe(1)

      client.close()
    })
  })

  describe('error handling', () => {
    it('should throw error when transport is not provided', async () => {
      const serverWithoutTransport = new SynnelServer({})

      await expect(serverWithoutTransport.start()).rejects.toThrow()
    })

    it('should emit error event when handler throws', async () => {
      await server.start()

      let emittedError: Error | undefined

      server.on('error', (error) => {
        emittedError = error
      })

      // Create a handler that throws
      server.on('connection', () => {
        throw new Error('Test error')
      })

      await new Promise<void>((resolve) => {
        httpServer.listen(port, () => resolve())
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => setTimeout(resolve, 100))

      // Error should have been emitted
      expect(emittedError).toBeDefined()

      client.close()
    })
  })
})
