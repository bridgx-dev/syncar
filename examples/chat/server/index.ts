/**
 * Syncar Chat Server - Updated API
 *
 * Demonstrates:
 * - Auto-relay: presence and presence channels relay automatically (no onMessage needed)
 * - Intercept pattern: chat channel uses onMessage to enrich messages before relaying
 * - Middleware for subscribe/unsubscribe lifecycle events
 * - Correct subscriber counts via channel.subscriberCount
 */

import express from 'express'
import { createServer } from 'http'
import { createSyncaServer } from '@syncar/server'

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

// Store connected users (clientId -> username)
const users = new Map<string, { username: string; status: string }>()

// Create Express app and HTTP synca
const app = express()
const httpServer = createServer(app)

// Initialize Syncar synca
const synca = createSyncaServer({ server: httpServer })

async function main() {
    await synca.start()

    // ============================================================
    // CHANNELS
    // ============================================================

    // Chat - intercept to enrich messages, then relay to all subscribers
    const chat = synca.createMulticast<ChatMessage>('chat')

    // Presence - auto-relay (no onMessage needed)
    const presence = synca.createMulticast<PresenceMessage>('presence')

    // Notifications - broadcast to all connected clients
    const notifications = synca.createBroadcast<NotificationMessage>()

    // ============================================================
    // SUBSCRIBE / UNSUBSCRIBE LIFECYCLE — via middleware
    // ============================================================

    chat.use(async (ctx, next) => {
        const { action, client } = ctx.req

        if (action === 'subscribe' && client) {
            const memberCount = chat.subscriberCount + 1 // incremented after middleware
            console.log(`[Chat] ${client.id} joined. Members: ${memberCount}`)

            // Send system welcome message only to the joining client
            chat.publish(
                {
                    id: `sys-${Date.now()}`,
                    type: 'system',
                    text: `Welcome!`,
                    user: 'System',
                    timestamp: Date.now(),
                    count: memberCount,
                } as ChatMessage & { count: number },
                { to: [client.id] },
            )
        }

        if (action === 'unsubscribe' && client) {
            const leftCount = Math.max(0, chat.subscriberCount - 1)
            console.log(
                `[Chat] ${client.id} left. Members remaining: ${leftCount}`,
            )
            users.delete(client.id)
        }

        await next()
    })

    // ============================================================
    // CHAT MESSAGES — intercept to enrich, then relay
    // ============================================================

    chat.onMessage(async (data, client) => {
        // Store the client's display name
        users.set(client.id, { username: data.user, status: 'online' })

        console.log(`[Chat] ${data.user}: ${data.text}`)

        // Relay the enriched message to ALL chat subscribers (including sender)
        chat.publish({ ...data, timestamp: Date.now() })
    })

    // Presence channel uses auto-relay — no onMessage handler needed
    // Messages sent by any client are automatically forwarded to all presence subscribers

    // ============================================================
    // CONNECTION LIFECYCLE — via global middleware
    // ============================================================

    synca.use(async (ctx, next) => {
        const { action, client } = ctx.req

        if (action === 'connect' && client) {
            console.log(`[Server] Client connected: ${client.id}`)
            // Notify all clients about new connection
            notifications.publish({
                type: 'info',
                message: `A new user connected. Total: ${synca.getStats().clientCount}`,
                timestamp: Date.now(),
            })
        }

        if (action === 'disconnect' && client) {
            const user = users.get(client.id)
            console.log(
                `[Server] Client disconnected: ${client.id} (${user?.username ?? 'unknown'})`,
            )
            users.delete(client.id)
        }

        await next()
    })

    // ============================================================
    // HTTP SERVER
    // ============================================================

    const PORT = 3001

    httpServer.listen(PORT, () => {
        console.log('')
        console.log('==================================')
        console.log(' Syncar Chat Server')
        console.log('==================================')
        console.log(`HTTP:      http://localhost:${PORT}`)
        console.log(`WebSocket: ws://localhost:${PORT}/syncar`)
        console.log(`Client:    http://localhost:3000`)
        console.log('')
        console.log('Channels:')
        console.log('  - chat         (multicast, intercept mode)')
        console.log('  - presence     (multicast, auto-relay)')
        console.log('  - notifications (broadcast)')
        console.log('')
    })

    // Print synca stats every 30 seconds
    setInterval(() => {
        const stats = synca.getStats()
        console.log('[Stats]', {
            clients: stats.clientCount,
            channels: stats.channelCount,
            subscriptions: stats.subscriptionCount,
            chatMembers: chat.subscriberCount,
            presenceMembers: presence.subscriberCount,
            uptime: stats.startedAt
                ? Math.floor((Date.now() - stats.startedAt) / 1000) + 's'
                : 'N/A',
        })
    }, 30000)
}

main().catch((error) => {
    console.error('Failed to start synca:', error)
    process.exit(1)
})

process.on('SIGINT', async () => {
    console.log('\nShutting down synca...')
    await synca.stop()
    httpServer.close()
    console.log('Server stopped')
    process.exit(0)
})
