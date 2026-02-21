# Synnel ⚡️

Synnel is a high-performance, developer-friendly real-time synchronization engine. It provides a simple, isomorphic bridge to keep your frontend and backend in perfect sync with zero configuration.

Think of it as the real-time layer of platforms like Convex or Supabase, but completely database-agnostic and self-hosted on any Node.js server.

## 🌟 Key Features

- **Isomorphic Core**: Seamlessly share model types and logic between client and server.
- **Fluent API**: A clean, chainable API that makes socket management feel like native events.
- **Channel Isolation**: Built-in Multicast, Unicast, and Broadcast patterns.
- **React-Native Integration**: Battle-tested hooks that handle React components' lifecycle (including Strict Mode) without connection drops.
- **Smart Signaling**: Automatic deduplication of signals to ensure minimal network overhead during complex UI re-renders.
- **Security-First**: Optional "Strict Mode" to restrict client-side channel creation to only pre-defined server channels.

## 🏗️ Workspace Structure

- `packages/core`: The isomorphic transport layer (Server/Client).
- `packages/react`: React components and hooks for state synchronization.
- `example/`: A full-stack demonstration (Chat & Mouse Tracking).

## 🚀 Quick Start

### 1. Server Setup (Node.js)

```typescript
import express from 'express'
import { Synnel } from '@synnel/core'

const app = express()
const server = app.listen(3000)

// Initialize Synnel
const synnel = new Synnel(server, { strict: true })

// Define a multicast channel
const chat = synnel.multicast('chat')

// Intercept and manipulate data on the server
chat.receive((data: any, client) => {
  console.log(`Received from ${client.getId()}:`, data)
})

// Send data to all subscribers of the channel
chat.send({ text: 'Welcome to Synnel!' })
```

### 2. Provider Setup (React)

Wrap your application in the `SynnelProvider`:

```tsx
import { SynnelProvider } from '@synnel/react'

function Root() {
  return (
    <SynnelProvider url="ws://localhost:3000">
      <App />
    </SynnelProvider>
  )
}
```

### 3. Usage in Hooks

```tsx
import { useChannel } from '@synnel/react'

function ChatRoom() {
  const { data, send, status } = useChannel('chat')

  return (
    <div>
      <p>Connection: {status}</p>
      <button onClick={() => send({ text: 'Hello World' })}>
        Send Message
      </button>
      <pre>{JSON.stringify(data)}</pre>
    </div>
  )
}
```

## 🔐 Security & Governance

Synnel supports an optional **Strict Mode**. When enabled, the server will reject any subscription attempt to a channel that wasn't explicitly created on the server via `multicast` or `broadcast`.

```typescript
// On the server
const synnel = new Synnel(server, { strict: true })

// Only 'global' can be joined by frontends
synnel.broadcast('global')

// You can also add custom authorization logic
synnel.authorize(async (clientId, channel, action) => {
  if (channel === 'admin' && !isUserAdmin(clientId)) return false
  return true
})
```

## 🛠 Advanced Features

### Server-Side Global Interceptors

You can listen to all messages passing through the system for logging, metrics, or auditing:

```typescript
synnel.onMessage((msg, client) => {
  console.log(`Global Trace: ${client.getId()} sent ${msg.type}`)
})
```

### Unicast: Direct Client Communication

Target specific clients by their unique ID:

```typescript
synnel.unicast('user-123').send({
  type: 'NOTIFICATION',
  text: 'Direct Message!',
})
```

## 📄 License

MIT
