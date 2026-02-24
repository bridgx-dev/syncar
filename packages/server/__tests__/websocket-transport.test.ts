/**
 * WebSocketServerTransport Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketServerTransport } from '../src/transport/index.js'
import { createServer as createHttpServer, type Server as HttpServer } from 'http'
import { WebSocket } from 'ws'
import type { IClientConnection } from '../src/types/index.js'
import { generateClientId } from '@synnel/lib'

describe('WebSocketServerTransport', () => {
  let httpServer: HttpServer
  let transport: WebSocketServerTransport
  let port: number

  beforeEach(async () => {
    // Get available port
    port = 3000 + Math.floor(Math.random() * 1000)

    httpServer = createHttpServer()
    transport = new WebSocketServerTransport({ server: httpServer, path: '/ws' })

    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => resolve())
    })

    await transport.start()
  })

  afterEach(async () => {
    await transport.stop()
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
    })
  })

  describe('connection handling', () => {
    it('should generate unique client IDs for each connection', async () => {
      const connections: IClientConnection[] = []

      transport.on('connection', (connection) => {
        connections.push(connection)
      })

      // Create multiple connections
      const client1 = new WebSocket(`ws://localhost:${port}/ws`)
      const client2 = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        let connected = 0
        const check = () => {
          if (connections.length === 2) {
            resolve()
          } else {
            setTimeout(check, 10)
          }
        }
        check()
      })

      expect(connections[0].id).not.toBe(connections[1].id)
      expect(connections[0].id).toMatch(/^client-\d+$/)
      expect(connections[1].id).toMatch(/^client-\d+$/)

      client1.close()
      client2.close()
    })

    it('should emit connection event with proper connection object', async () => {
      let receivedConnection: IClientConnection | undefined

      transport.on('connection', (connection) => {
        receivedConnection = connection
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (receivedConnection) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(receivedConnection).toBeDefined()
      expect(receivedConnection?.status).toBe('connected')
      expect(receivedConnection?.connectedAt).toBeLessThanOrEqual(Date.now())
      expect(receivedConnection?.socket).toBeDefined()

      client.close()
    })

    it('should track connections in connections map', async () => {
      transport.on('connection', () => {})

      const client1 = new WebSocket(`ws://localhost:${port}/ws`)
      const client2 = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (transport.connections.size === 2) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(transport.connections.size).toBe(2)

      client1.close()
      client2.close()
    })
  })

  describe('message handling', () => {
    it('should emit message event with client ID and message data', async () => {
      let receivedMessage: any

      transport.on('connection', () => {})
      transport.on('message', (clientId, message) => {
        receivedMessage = { clientId, message }
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
          if (receivedMessage) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(receivedMessage).toBeDefined()
      expect(receivedMessage.clientId).toMatch(/^client-\d+$/)
      expect(receivedMessage.message.type).toBe('data')
      expect(receivedMessage.message.data).toEqual({ text: 'hello' })

      client.close()
    })
  })

  describe('disconnection handling', () => {
    it('should emit disconnection event with client ID', async () => {
      let disconnectedClientId: string | undefined

      transport.on('connection', () => {})
      transport.on('disconnection', (clientId) => {
        disconnectedClientId = clientId
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      client.close()

      await new Promise<void>((resolve) => {
        const check = () => {
          if (disconnectedClientId) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(disconnectedClientId).toMatch(/^client-\d+$/)
    })

    it('should remove client from connections map on disconnect', async () => {
      transport.on('connection', () => {})
      transport.on('disconnection', () => {})

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (transport.connections.size === 1) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      client.close()

      await new Promise<void>((resolve) => {
        const check = () => {
          if (transport.connections.size === 0) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      expect(transport.connections.size).toBe(0)
    })

    it('should emit disconnection event BEFORE deleting from connections', async () => {
      let connectionsDuringEvent = 0

      transport.on('connection', () => {})
      transport.on('disconnection', () => {
        connectionsDuringEvent = transport.connections.size
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (transport.connections.size === 1) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      client.close()

      await new Promise<void>((resolve) => setTimeout(resolve, 100))

      // Client should still be in connections when event is emitted
      expect(connectionsDuringEvent).toBe(1)
      expect(transport.connections.size).toBe(0)
    })
  })

  describe('sendToClient', () => {
    it('should send message to specific client', async () => {
      transport.on('connection', () => {})

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      // Get the client ID
      await new Promise<void>((resolve) => {
        const check = () => {
          if (transport.connections.size === 1) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      const clientId = Array.from(transport.connections.keys())[0]

      const message = {
        type: 'data',
        channel: 'test',
        data: { text: 'response' },
      }

      await transport.sendToClient(clientId, message as any)

      await new Promise<void>((resolve) => {
        client.on('message', (data) => {
          expect(JSON.parse(data.toString())).toEqual(message)
          resolve()
        })
      })

      client.close()
    })

    it('should handle sending to non-existent client gracefully', async () => {
      const message = { type: 'data', channel: 'test', data: {} }

      await expect(transport.sendToClient('non-existent', message as any)).resolves.not.toThrow()
    })
  })

  describe('ping/pong heartbeat', () => {
    it('should send ping frames at configured interval', async () => {
      const transportWithPing = new WebSocketServerTransport({
        server: httpServer,
        path: '/ws-ping',
        pingInterval: 100,
        pingTimeout: 500,
      })

      await transportWithPing.start()

      transportWithPing.on('connection', () => {})

      const client = new WebSocket(`ws://localhost:${port}/ws-ping`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      // Wait for at least one ping
      await new Promise<void>((resolve) => setTimeout(resolve, 200))

      client.close()
      await transportWithPing.stop()
    }, 10000)
  })

  describe('start/stop', () => {
    it('should start the transport', async () => {
      const newTransport = new WebSocketServerTransport({
        server: httpServer,
        path: '/ws-start',
      })

      await expect(newTransport.start()).resolves.not.toThrow()

      await newTransport.stop()
    })

    it('should stop the transport and close all connections', async () => {
      transport.on('connection', () => {})

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => {
        const check = () => {
          if (transport.connections.size === 1) resolve()
          else setTimeout(check, 10)
        }
        check()
      })

      await transport.stop()

      expect(transport.connections.size).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should emit error event on WebSocket error', async () => {
      let receivedError: Error | undefined

      transport.on('connection', () => {})
      transport.on('error', (error) => {
        receivedError = error
      })

      const client = new WebSocket(`ws://localhost:${port}/ws`)

      await new Promise<void>((resolve) => client.on('open', resolve))

      // Send invalid data to trigger error
      ;(client as any)._socket.write(Buffer.from([0x00, 0x01]))

      await new Promise<void>((resolve) => setTimeout(resolve, 100))

      client.close()
    })
  })

  describe('configuration', () => {
    it('should use custom path from config', async () => {
      const customTransport = new WebSocketServerTransport({
        server: httpServer,
        path: '/custom-path',
      })

      await customTransport.start()

      // Try connecting to custom path
      const client = new WebSocket(`ws://localhost:${port}/custom-path`)

      await new Promise<void>((resolve) => {
        client.on('open', () => resolve())
        client.on('error', () => resolve())
      })

      client.close()
      await customTransport.stop()
    })
  })
})
