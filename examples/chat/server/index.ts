/**
 * Synnel Chat Server V2 - Express Integration
 *
 * A chat server demonstrating the new V2 API:
 * - Express.js integration with @synnel/server
 * - Channel-based messaging (chat, notifications, presence)
 * - Broadcast functionality
 * - Explicit channel creation (multicast, broadcast)
 * - Connection event handling
 * - Authorization middleware
 *
 * V2 API Changes:
 * - Use `createSynnelServer()` instead of `new Synnel()`
 * - Use `server.createMulticast()` instead of `synnel.multicast()`
 * - Use `server.createBroadcast()` instead of `synnel.broadcast()`
 * - Messages are NOT auto-relayed - call `channel.publish()` explicitly in handlers
 * - Use `channel.onMessage()` or `channel.receive()` for message handling
 */

import express from 'express'
import { createServer } from 'http'
import { createSynnelServer } from '@synnel/server'

// Message types
interface ChatMessage {
  id: string
  type: 'message' | 'system'
  text: string
  user: string
  timestamp: number
}

interface PresenceMessage {
  userId: string
  username: string
  status: 'online' | 'offline' | 'typing'
}

interface NotificationMessage {
  type: 'info' | 'warning' | 'success'
  message: string
  timestamp: number
}

// Store connected users
const users = new Map<string, { username: string; status: string }>()

// Create Express app and HTTP server
const app = express()
const httpServer = createServer(app)

// Initialize Synnel V2 server with the Express server
const server = createSynnelServer({ server: httpServer })

// Global variables for channels (will be initialized after start())
let chat: ReturnType<typeof server.createMulticast<ChatMessage>>
let presence: ReturnType<typeof server.createMulticast<PresenceMessage>>
let notifications: ReturnType<
  typeof server.createBroadcast<NotificationMessage>
>

async function main() {
  // Start the server first
  await server.start()

  // Create channels after server is started
  chat = server.createMulticast<ChatMessage>('chat')
  presence = server.createMulticast<PresenceMessage>('presence')
  notifications = server.createBroadcast<NotificationMessage>()

  // ============================================================
  // HANDLE INCOMING CHAT MESSAGES
  // ============================================================

  // V2: Use channel.onMessage() to handle incoming messages
  // Messages are NOT auto-relayed in V2, so we explicitly publish
  chat.onMessage(async (data, client) => {
    console.log(`[Chat] ${data.user}: ${data.text}`)

    // Store the username if not already stored
    if (!users.has(client.id)) {
      users.set(client.id, { username: data.user, status: 'online' })
    }

    // V2: Explicitly publish message to all subscribers
    // The sender will also receive it back (client-side can filter if needed)
    chat.publish(data)
  })

  // ============================================================
  // HANDLE PRESENCE UPDATES
  // ============================================================

  presence.onMessage(async (data) => {
    console.log(`[Presence] ${data.username}: ${data.status}`)

    // V2: Explicitly publish presence update to all subscribers
    presence.publish(data)
  })

  // ============================================================
  // START HTTP SERVER
  // ============================================================

  const PORT = 3001

  httpServer.listen(PORT, () => {
    console.log('')
    console.log('==================================')
    console.log(' Synnel Chat Server V2')
    console.log('==================================')
    console.log(`HTTP: http://localhost:${PORT}`)
    console.log(`WebSocket: ws://localhost:${PORT}/synnel`)
    console.log(`Client: http://localhost:3000`)
    console.log('')
    console.log('Available channels:')
    console.log('  - chat (multicast)')
    console.log('  - presence (multicast)')
    console.log('  - notifications (broadcast)')
    console.log('')
    console.log('Channels are explicitly created on the server.')
    console.log(
      'Clients can ONLY join channels created via createMulticast() or createBroadcast().',
    )
    console.log('')
  })

  // Print server stats every 30 seconds
  setInterval(() => {
    const stats = server.getStats()
    console.log('[Stats]', {
      clients: stats.clientCount,
      channels: stats.channelCount,
      subscriptions: stats.subscriptionCount,
      uptime: stats.startedAt
        ? Math.floor((Date.now() - stats.startedAt) / 1000) + 's'
        : 'N/A',
    })
  }, 30000)
}

// ============================================================
// STARTUP
// ============================================================

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.on('SIGINT', async () => {
  console.log('\nShutting down server...')
  await server.stop()
  httpServer.close()
  console.log('Server stopped')
  process.exit(0)
})
