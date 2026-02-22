# Synnel ⚡️

Synnel is a high-performance, developer-friendly real-time synchronization engine. It provides a simple, isomorphic bridge to keep your frontend and backend in perfect sync with zero configuration.

Think of it as the real-time layer of platforms like Convex or Supabase, but completely database-agnostic and self-hosted on any Node.js server.

## 🌟 Key Features

- **Isomorphic Core**: Seamlessly share model types and logic between client and server.
- **Express Integration**: Native support for Express.js with WebSocket attachment.
- **Channel Isolation**: Built-in Multicast and Broadcast patterns.
- **React Integration**: Battle-tested hooks that handle React components' lifecycle (including Strict Mode) without connection drops.
- **Smart Signaling**: Automatic deduplication of signals to ensure minimal network overhead during complex UI re-renders.
- **Channel Enforcement**: Channels must be explicitly created on the server before clients can join them.
- **Type-Safe**: Full TypeScript support with shared types across frontend and backend.

## 🏗️ Workspace Structure

- `packages/core`: The isomorphic transport layer.
- `packages/server`: Node.js server for Synnel with Express integration.
- `packages/client`: Framework-agnostic real-time client.
- `packages/adapter`: WebSocket transport adapters.
- `packages/react`: React components and hooks for state synchronization.

## 🚀 Quick Start

### 1. Server Setup (with Express)

```typescript
import express from 'express'
import { createServer } from 'http'
import { Synnel } from '@synnel/server'

const app = express()
const httpServer = createServer(app)

// Initialize Synnel with Express server
const synnel = new Synnel({ server: httpServer })

// Create a multicast channel (returns a Promise)
const chat = await synnel.multicast<{ text: string; user: string }>('chat')

// Handle incoming messages
chat.receive((data, client) => {
  console.log(`Received from ${client.id}:`, data)
})

// Start the server
await synnel.start()
httpServer.listen(3000)
```

### 2. Standalone Server (no Express)

```typescript
import { Synnel } from '@synnel/server'

// Creates HTTP server on port 3000
const synnel = new Synnel({ port: 3000 })

await synnel.start()

const chat = await synnel.multicast('chat')
chat.send({ text: 'Welcome!' })
```

### 3. Provider Setup (React)

Wrap your application in the `SynnelProvider`:

```tsx
import { SynnelProvider } from '@synnel/react'
import { createSynnelClient } from '@synnel/client'
import { WebSocketClientTransport } from '@synnel/adapter'

const client = createSynnelClient({
  transport: new WebSocketClientTransport({
    url: 'ws://localhost:3000/synnel',
  }),
})

function Root() {
  return (
    <SynnelProvider client={client}>
      <App />
    </SynnelProvider>
  )
}
```

### 4. Usage in Hooks

```tsx
import { useChannel } from '@synnel/react'

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

Synnel enforces explicit channel creation. Channels must be created on the server before clients can join them.

```typescript
// Server - Create channels explicitly
const chat = await synnel.multicast('chat') // ✅ Clients CAN join
const notifications = synnel.broadcast() // ✅ Clients CAN join
// 'admin' NOT created                                   // ❌ Clients CANNOT join
```

```typescript
// Client trying to join non-created channel
await client.subscribe('admin') // ❌ ERROR: Channel not allowed
```

## 📡 Channel Types

### Multicast Channel

Many-to-many messaging. All subscribers can send and receive messages.

```typescript
const chat = await synnel.multicast<MessageType>('chat')

// Receive messages from clients
chat.receive((data, client) => {
  console.log(`${client.id}: ${data.text}`)
})

// Send to all subscribers (optionally exclude sender)
await chat.send(data, excludeClientId)
```

### Broadcast Channel

Server-to-all messaging. Only the server can send; all clients receive.

```typescript
const notifications = synnel.broadcast<NotificationType>()

// Send to all connected clients
await notifications.send({
  type: 'info',
  message: 'Server maintenance in 5 minutes',
})
```

## 🔑 Authorization

Add custom authorization logic:

```typescript
synnel.authorize(async (clientId, channel, action) => {
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
synnel.onMessage((client, message) => {
  console.log(`Client ${client.id} sent message type: ${message.type}`)
})
```

### Connection Events

```typescript
synnel.on('connection', (client) => {
  console.log(`Client connected: ${client.id}`)
})

synnel.on('disconnection', (client) => {
  console.log(`Client disconnected: ${client.id}`)
})

synnel.on('subscribe', (client, channel) => {
  console.log(`${client.id} subscribed to ${channel}`)
})
```

### Server Statistics

```typescript
const stats = synnel.getStats()
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
npm install @synnel/core @synnel/server @synnel/client

# Adapter (WebSocket transport)
npm install @synnel/adapter

# React integration
npm install @synnel/react
```

## 📄 License

MIT
