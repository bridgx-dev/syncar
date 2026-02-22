/**
 * Synnel v2 Chat Server
 *
 * A simple chat server demonstrating:
 * - WebSocket server with @synnel/server-v2
 * - Channel-based messaging (chat, notifications, presence)
 * - Broadcast functionality
 * - Middleware for logging and rate limiting
 * - Connection event handling
 */

import { createSynnelServer, createLoggingMiddleware, createRateLimitMiddleware } from '@synnel/server-v2'
import { WebSocketServerTransport } from '@synnel/adapter-ws-v2'
import { MessageType } from '@synnel/core-v2'

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

// Create the WebSocket transport
const transport = new WebSocketServerTransport({
  port: 3001,
})

// Create the server with middleware and allowed channels
const server = createSynnelServer({
  transport,
  // Only allow these channels
  channels: ['chat', 'notifications', 'presence'],
  // Add middleware
  middleware: [
    // Log all connections, messages, and subscriptions
    createLoggingMiddleware({
      logConnections: true,
      logMessages: true,
      logSubscriptions: true,
      logger: console.log,
    }),
    // Rate limit: 60 messages per minute per client
    createRateLimitMiddleware({
      maxMessages: 60,
      windowMs: 60000,
    }),
  ],
})

// Initialize channels and setup handlers
async function initializeServer() {
  // Get the chat channel
  const chat = await server.channel<ChatMessage>('chat')

  // Handle incoming chat messages
  chat.onMessage((data, client) => {
    console.log(`[Chat] ${data.user}: ${data.text}`)

    // Store the username if not already stored
    if (!users.has(client.id)) {
      users.set(client.id, { username: data.user, status: 'online' })
    }
  })

  // Get the presence channel for online/offline status
  const presence = await server.channel<PresenceMessage>('presence')

  presence.onMessage((data, client) => {
    console.log(`[Presence] ${data.username}: ${data.status}`)

    // Update user status
    if (data.status === 'online') {
      users.set(client.id, { username: data.username, status: 'online' })
    }

    // Broadcast presence update to all subscribers (handled automatically)
  })

  // Get the notifications channel for server announcements
  const notifications = await server.channel<NotificationMessage>('notifications')

  // Handle connection events
  server.on('connection', (client) => {
    console.log(`[Connection] Client connected: ${client.id}`)

    // Send welcome notification to the new client
    client.send({
      id: 'welcome',
      type: MessageType.DATA,
      channel: 'notifications',
      data: {
        type: 'success',
        message: 'Welcome to the Synnel v2 chat server!',
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    })

    // Send current user count
    const userCount = users.size
    client.send({
      id: 'user-count',
      type: MessageType.DATA,
      channel: 'notifications',
      data: {
        type: 'info',
        message: `Users online: ${userCount}`,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    })
  })

  // Handle disconnection events
  server.on('disconnection', async (client, event) => {
    console.log(`[Disconnection] Client disconnected: ${client.id} (${event.code})`)

    const user = users.get(client.id)
    if (user) {
      // Remove user from active users
      users.delete(client.id)

      // Broadcast user offline notification via presence channel
      const subscribers = server.getStats().subscriptionCount
      // Note: The user will have already been unsubscribed, so we send
      // the notification through a different mechanism or accept the delay
    }
  })

  // Handle subscription events
  server.on('subscribe', (client, channel) => {
    console.log(`[Subscribe] ${client.id} -> ${channel}`)

    // Send system message to chat when someone subscribes
    if (channel === 'chat') {
      const user = users.get(client.id)
      if (user) {
        // Could send a "joined" message here
      }
    }
  })

  // Handle errors
  server.on('error', (error) => {
    console.error('[Error]', error)
  })
}

// Start the server
async function main() {
  try {
    // Initialize channels and handlers
    await initializeServer()

    // Start the server
    await server.start()

    console.log('')
    console.log('==================================')
    console.log(' Synnel v2 Chat Server')
    console.log('==================================')
    console.log(`Server: ws://localhost:3001`)
    console.log(`Client: http://localhost:3000`)
    console.log('')
    console.log('Allowed channels: chat, notifications, presence')
    console.log('')

    // Print server stats every 30 seconds
    setInterval(() => {
      const stats = server.getStats()
      console.log('[Stats]', {
        clients: stats.clientCount,
        channels: stats.channelCount,
        subscriptions: stats.subscriptionCount,
        messagesReceived: stats.messagesReceived,
        messagesSent: stats.messagesSent,
        uptime: stats.startedAt ? Math.floor((Date.now() - stats.startedAt) / 1000) + 's' : 'N/A',
      })
    }, 30000)

  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...')
  await server.stop()
  console.log('Server stopped')
  process.exit(0)
})

main()
