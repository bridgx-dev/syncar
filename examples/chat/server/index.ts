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
import type { IServerClient } from '@synnel/server'

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
let notifications: ReturnType<typeof server.createBroadcast<NotificationMessage>>

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
  // HANDLE CONNECTION EVENTS
  // ============================================================

  server.on('connection', (client) => {
    console.log(`[Connection] Client connected: ${client.id}`)

    // Broadcast updated user count to all clients
    const stats = server.getStats()
    notifications.publish({
      type: 'info',
      message: `Users online: ${stats.clientCount}`,
      timestamp: Date.now(),
    })
  })

  // ============================================================
  // HANDLE DISCONNECTION EVENTS
  // ============================================================

  server.on('disconnection', (client) => {
    console.log(`[Disconnection] Client disconnected: ${client.id}`)

    const user = users.get(client.id)
    if (user) {
      // Remove user from active users
      users.delete(client.id)

      // Broadcast user offline notification via presence channel
      presence.publish({
        userId: client.id,
        username: user.username,
        status: 'offline',
      })

      // Send a system message to chat that user left
      chat.publish({
        id: `system-${Date.now()}`,
        type: 'system',
        text: `${user.username} left the chat`,
        user: 'System',
        timestamp: Date.now(),
      })
    }

    // Broadcast updated user count to all clients
    const stats = server.getStats()
    notifications.publish({
      type: 'info',
      message: `Users online: ${stats.clientCount}`,
      timestamp: Date.now(),
    })
  })

  // ============================================================
  // HANDLE SUBSCRIPTION EVENTS
  // ============================================================

  server.on('subscribe', (client, channel) => {
    console.log(`[Subscribe] ${client.id} -> ${channel}`)

    // When someone subscribes to chat, update the user count
    if (channel === 'chat') {
      const user = users.get(client.id)
      if (user) {
        // Send system message to chat
        chat.publish({
          id: `system-${Date.now()}`,
          type: 'system',
          text: `${user.username} joined the chat`,
          user: 'System',
          timestamp: Date.now(),
        })
      }

      // Broadcast updated user count
      const stats = server.getStats()
      notifications.publish({
        type: 'info',
        message: `Users online: ${stats.clientCount}`,
        timestamp: Date.now(),
      })
    }
  })

  // ============================================================
  // HANDLE ERRORS
  // ============================================================

  server.on('error', (error) => {
    console.error('[Error]', error)
  })

  // ============================================================
  // AUTHORIZATION MIDDLEWARE
  // ============================================================

  // Add authorization middleware (optional)
  server.authorize(async (clientId, channel, action) => {
    // Log authorization checks
    console.log(`[Auth] ${clientId} wants to ${action} on ${channel}`)
    // Allow all actions for this example
    // In production, you would check authentication tokens, database, etc.
    return true
  })

  // ============================================================
  // GLOBAL MESSAGE INTERCEPTOR
  // ============================================================

  // Global message interceptor (optional)
  server.onMessage((client, message) => {
    console.log(
      `[Message] Client ${client.id} sent message type: ${message.type}`,
    )
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
      messagesReceived: stats.messagesReceived,
      messagesSent: stats.messagesSent,
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
