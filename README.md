# Syncar ⚡️

Syncar is a high-performance, developer-friendly real-time synchronization engine. It provides a simple, isomorphic bridge to keep your frontend and backend in perfect sync with zero configuration.

Think of it as the real-time layer of platforms like Convex or Supabase, but completely database-agnostic and self-hosted on any Node.js server.

## 🌟 Key Features

- **Isomorphic Core**: Seamlessly share model types and logic between client and server.
- **Express Integration**: Native support for Express.js with WebSocket attachment.
- **Unified Channel API**: Single `createChannel()` method with configurable scope and flow options.
- **React Integration**: Battle-tested hooks that handle React components' lifecycle (including Strict Mode) without connection drops.
- **Smart Signaling**: Automatic deduplication of signals to ensure minimal network overhead during complex UI re-renders.
- **Channel Enforcement**: Channels must be explicitly created on the server before clients can join them.
- **Type-Safe**: Full TypeScript support with shared types across frontend and backend.

## 🏗️ Workspace Structure

- `packages/core`: The isomorphic transport layer.
- `packages/server`: Node.js server for Syncar with Express integration.
- `packages/client`: Framework-agnostic real-time client.
- `packages/adapter`: WebSocket transport adapters.
- `packages/react`: React components and hooks for state synchronization.

## 🚀 Quick Start

### 1. Server Setup (with Express)

```typescript
import express from 'express'
import { createServer } from 'http'
import { createSyncarServer } from '@syncar/server'

const app = express()
const httpServer = createServer(app)

// Initialize Syncar with Express server
const syncar = createSyncarServer({ server: httpServer })

// Start the server first
await syncar.start()

// Create channels
const chat = syncar.createChannel<{ text: string; user: string }>('chat') // Subscribers + bidirectional (default)
const alerts = syncar.createChannel('alerts', { scope: 'broadcast' }) // All clients

// Handle incoming messages
chat.onMessage((data, client) => {
    console.log(`Received from ${client.id}:`, data)
    // Relay to all other clients
    chat.publish(data, { exclude: [client.id] })
})

httpServer.listen(3000)
```

### 2. Standalone Server (no Express)

```typescript
import { createSyncarServer } from '@syncar/server'

// Creates HTTP server on port 3000
const syncar = createSyncarServer({ port: 3000 })

await syncar.start()

const chat = syncar.createChannel('chat')

// One-off broadcast to all clients
syncar.broadcast({ message: 'Welcome!' })
```

### 3. Provider Setup (React)

Wrap your application in the `SyncarProvider`:

```tsx
import { SyncarProvider } from '@syncar/react'
import { createSyncarClient } from '@syncar/client'
import { WebSocketClientTransport } from '@syncar/client'

const client = createSyncarClient({
    transport: new WebSocketClientTransport({
        url: 'ws://localhost:3000/syncar',
    }),
})

function Root() {
    return (
        <SyncarProvider client={client}>
            <App />
        </SyncarProvider>
    )
}
```

### 4. Usage in Hooks

```tsx
import { useChannel } from '@syncar/react'

function ChatRoom() {
    const chat = useChannel<{ text: string }>('chat', {
        onMessage: (data) => {
            console.log('Received:', data.text)
        },
    })

    return (
        <div>
            <button onClick={() => chat.send({ text: 'Hello World' })}>
                Send Message
            </button>
        </div>
    )
}
```

## 🔐 Channel Enforcement

Syncar enforces explicit channel creation. Channels must be created on the server before clients can join them.

```typescript
// Server - Create channels explicitly
const chat = syncar.createChannel('chat') // ✅ Clients CAN join
const notifications = syncar.createChannel('notifications', {
    scope: 'broadcast',
}) // ✅ Clients CAN join
// 'admin' NOT created // ❌ Clients CANNOT join
```

```typescript
// Client trying to join non-created channel
await client.subscribe('admin') // ❌ ERROR: Channel not allowed
```

## 📡 Channel Types

### Subscriber Channel (default)

Many-to-many messaging. Only subscribed clients receive messages, and all subscribers can send and receive.

```typescript
const chat = syncar.createChannel<MessageType>('chat')
// Same as: syncar.createChannel<MessageType>('chat', { scope: 'subscribers' })

// Receive messages from clients
chat.onMessage((data, client) => {
    console.log(`${client.id}: ${data.text}`)
    // Relay to all subscribers except sender
    chat.publish(data, { exclude: [client.id] })
})

// Publish to all subscribers
await chat.publish(data)
```

### Broadcast Channel

Server-to-all messaging. All connected clients receive messages, regardless of subscription.

```typescript
const notifications = syncar.createChannel<NotificationType>('notifications', {
    scope: 'broadcast',
})

// Send to all connected clients
await notifications.publish({
    type: 'info',
    message: 'Server maintenance in 5 minutes',
})

// Or use the convenience method for one-off broadcasts
syncar.broadcast({ message: 'Server maintenance in 5 minutes' })
```

## 🔑 Authorization

Add custom authorization logic:

```typescript
syncar.authorize(async (clientId, channel, action) => {
    if (channel === 'admin') {
        return await isAdminUser(clientId)
    }
    return true
})
```

## 🛠 Advanced Features

### Global Message Interceptor

Listen to all messages passing through the system:

```typescript
syncar.onMessage((client, message) => {
    console.log(`Client ${client.id} sent message type: ${message.type}`)
})
```

### Connection Events

```typescript
syncar.on('connection', (client) => {
    console.log(`Client connected: ${client.id}`)
})

syncar.on('disconnection', (client) => {
    console.log(`Client disconnected: ${client.id}`)
})

syncar.on('subscribe', (client, channel) => {
    console.log(`${client.id} subscribed to ${channel}`)
})
```

### Server Statistics

```typescript
const stats = syncar.getStats()
console.log({
    clients: stats.clientCount,
    channels: stats.channelCount,
    subscriptions: stats.subscriptionCount,
    messagesReceived: stats.messagesReceived,
    messagesSent: stats.messagesSent,
    uptime: stats.startedAt
        ? Math.floor((Date.now() - stats.startedAt) / 1000) + 's'
        : 'N/A',
})
```

## 📦 Installation

```bash
# Core packages
npm install @syncar/core @syncar/server @syncar/client

# Adapter (WebSocket transport)
npm install @syncar/adapter

# React integration
npm install @syncar/react
```

## 📄 License

MIT
