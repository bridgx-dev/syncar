/**
 * Synnel Chat Server - Express Integration
 *
 * A chat server demonstrating:
 * - Express.js integration with @synnel/server
 * - Channel-based messaging (chat, notifications, presence)
 * - Broadcast functionality
 * - Explicit channel creation (multicast, broadcast)
 * - Connection event handling
 * - Authorization middleware
 */

import express from 'express'
import { createServer } from 'http'
import { Synnel } from '@synnel/server'

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

// Initialize Synnel with the Express server
const synnel = new Synnel({ server: httpServer })

// Create channels - only these channels can be joined by clients
// Note: multicast() now returns a Promise
const chat = await synnel.multicast<ChatMessage>('chat')
const presence = await synnel.multicast<PresenceMessage>('presence')
const notifications = synnel.broadcast<NotificationMessage>()

// Handle incoming chat messages
chat.receive(async (data, client) => {
  console.log(`[Chat] ${data.user}: ${data.text}`)

  // Store the username if not already stored
  if (!users.has(client.id)) {
    users.set(client.id, { username: data.user, status: 'online' })
  }

  // Note: Messages are automatically relayed to all subscribers by the server
  // No need to manually call chat.send() here
})

// Handle presence updates
presence.receive(async (data, client) => {
  console.log(`[Presence] ${data.username}: ${data.status}`)

  // Update user status
  if (data.status === 'online') {
    users.set(client.id, { username: data.username, status: 'online' })
  }

  // Broadcast presence update to all subscribers
  await presence.send(data)
})

// Handle connection events
synnel.on('connection', (client) => {
  console.log(`[Connection] Client connected: ${client.id}`)

  // Broadcast updated user count to all clients
  const userCount = synnel.getStats().clientCount
  notifications.send({
    type: 'info',
    message: `Users online: ${userCount}`,
    timestamp: Date.now(),
  })
})

// Handle disconnection events
synnel.on('disconnection', async (client) => {
  console.log(`[Disconnection] Client disconnected: ${client.id}`)

  const user = users.get(client.id)
  if (user) {
    // Remove user from active users
    users.delete(client.id)

    // Broadcast user offline notification via presence channel
    await presence.send({
      userId: client.id,
      username: user.username,
      status: 'offline',
    })

    // Send a system message to chat that user left
    await chat.send({
      id: `system-${Date.now()}`,
      type: 'system',
      text: `${user.username} left the chat`,
      user: 'System',
      timestamp: Date.now(),
    })
  }

  // Broadcast updated user count to all clients
  const userCount = synnel.getStats().clientCount
  notifications.send({
    type: 'info',
    message: `Users online: ${userCount}`,
    timestamp: Date.now(),
  })
})

// Handle subscription events
synnel.on('subscribe', async (client, channel) => {
  console.log(`[Subscribe] ${client.id} -> ${channel}`)

  // When someone subscribes to chat, update the user count
  if (channel === 'chat') {
    const user = users.get(client.id)
    if (user) {
      // Send system message to chat
      await chat.send({
        id: `system-${Date.now()}`,
        type: 'system',
        text: `${user.username} joined the chat`,
        user: 'System',
        timestamp: Date.now(),
      })
    }

    // Broadcast updated user count
    const userCount = synnel.getStats().clientCount
    await notifications.send({
      type: 'info',
      message: `Users online: ${userCount}`,
      timestamp: Date.now(),
    })
  }
})

// Handle errors
synnel.on('error', (error) => {
  console.error('[Error]', error)
})

// Add authorization middleware (optional)
synnel.authorize(async (clientId, channel, action) => {
  // Log authorization checks
  console.log(`[Auth] ${clientId} wants to ${action} on ${channel}`)
  // Allow all actions for this example
  // In production, you would check authentication tokens, database, etc.
  return true
})

// Global message interceptor (optional)
// Note: Parameter order is (client, message) for consistency with event handlers
synnel.onMessage((client, message) => {
  console.log(
    `[Message] Client ${client.id} sent message type: ${message.type}`,
  )
})

// Start the server
const PORT = 3001

async function main() {
  await synnel.start()

  httpServer.listen(PORT, () => {
    console.log('')
    console.log('==================================')
    console.log(' Synnel Chat Server')
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
      'Clients can ONLY join channels created via multicast() or broadcast().',
    )
    console.log('')
  })

  // Print server stats every 30 seconds
  setInterval(() => {
    const stats = synnel.getStats()
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

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...')
  await synnel.stop()
  httpServer.close()
  console.log('Server stopped')
  process.exit(0)
})
