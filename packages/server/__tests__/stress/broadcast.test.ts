import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SynnelServer } from '../../src/server/synnel-server'
import { BroadcastChannel } from '../../src/channel/broadcast-channel'
import { IClientConnection } from '../../src/types'

describe('Chunked Broadcasting Stress Test', () => {
  let server: SynnelServer

  beforeEach(() => {
    server = new SynnelServer({
      broadcastChunkSize: 100, // Small chunk size for testing
    })
    // @ts-ignore - Mocking state and transport
    server.state.started = true
    // @ts-ignore
    server.transport = {
      connections: new Map(),
      on: vi.fn(),
    }
  })

  it('should not block the event loop when publishing to many subscribers', async () => {
    const subscriberCount = 1000
    const channelName = 'stress-test'

    // Mock connections
    for (let i = 0; i < subscriberCount; i++) {
      const clientId = `client-${i}`
      const connection: IClientConnection = {
        id: clientId,
        connectedAt: Date.now(),
        lastPingAt: Date.now(),
        socket: {
          send: vi.fn((_data, cb) => cb && cb(null)),
          close: vi.fn(),
          terminate: vi.fn(),
          readyState: 1,
        } as any,
      }
      server.registry.register(connection)
      server.registry.subscribe(clientId, channelName)
    }

    // Set up a "pulse" to monitor event loop lag
    let pulseCount = 0
    const pulseInterval = setInterval(() => {
      pulseCount++
    }, 10)

    // Start publishing
    server.createMulticast(channelName).publish('test data')

    // Wait for all chunks to be processed
    // 1000 subscribers / 100 per chunk = 10 chunks
    // Each chunk uses setImmediate, so we wait some time
    await new Promise((resolve) => setTimeout(resolve, 500))

    clearInterval(pulseInterval)

    // If it was synchronous/blocking, pulseCount would be 0 or very low
    // because the broadast would take most of the time.
    // With chunking, the interval should have fired multiple times.
    expect(pulseCount).toBeGreaterThan(5)

    // Verify all subscribers received the message
    for (let i = 0; i < subscriberCount; i++) {
      const client = server.registry.get(`client-${i}`)
      expect(client?.socket.send).toHaveBeenCalled()
    }
  })

  it('should not block the event loop when broadcasting to all connected clients', async () => {
    const connectionCount = 1000
    const connections = new Map<string, IClientConnection>()

    for (let i = 0; i < connectionCount; i++) {
      const id = `client-${i}`
      const connection: IClientConnection = {
        id,
        connectedAt: Date.now(),
        lastPingAt: Date.now(),
        socket: {
          send: vi.fn(),
          close: vi.fn(),
          terminate: vi.fn(),
          readyState: 1,
        } as any,
      }
      connections.set(id, connection)
    }

    const broadcastChannel = new BroadcastChannel(connections, 100)

    let pulseCount = 0
    const pulseInterval = setInterval(() => {
      pulseCount++
    }, 10)

    broadcastChannel.publish({ msg: 'broadcast test' })

    await new Promise((resolve) => setTimeout(resolve, 500))
    clearInterval(pulseInterval)

    expect(pulseCount).toBeGreaterThan(5)

    for (const client of connections.values()) {
      expect(client.socket.send).toHaveBeenCalled()
    }
  })
})
