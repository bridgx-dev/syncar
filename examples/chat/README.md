# Synnel Chat Example

A full-stack chat application demonstrating the Synnel real-time messaging framework with Express.js integration.

## Features

- **Real-time messaging** using WebSockets
- **Express.js integration** - Synnel attaches to your existing HTTP server
- **Channel-based communication** (chat, notifications, presence)
- **Multicast channels** - Many-to-many messaging for chat and presence
- **Broadcast channel** - Server-to-all notifications
- **Typing indicators** using presence channel
- **User presence** (online/offline status)
- **Live user count** displayed in the header
- **React hooks** for easy integration with onMessage callbacks
- **Beautiful UI** with smooth animations and avatars

## Tech Stack

### Server

- `@synnel/server` - WebSocket server with Express integration
- `@synnel/adapter` - WebSocket transport
- `@synnel/core` - Core types and protocols
- Express.js - HTTP server
- Node.js + TypeScript

### Client

- `@synnel/react` - React hooks and provider
- `@synnel/client` - Core client
- `@synnel/adapter` - WebSocket transport
- React 19 + Vite

## Project Structure

```
chat/
├── server/
│   └── index.ts          # WebSocket server with Express
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── components/
│   │       ├── Login.tsx
│   │       ├── Chat.tsx
│   │       └── Notifications.tsx
├── package.json
├── tsconfig.json
├── tsconfig.server.json
└── vite.config.ts
```

## Getting Started

### Installation

```bash
# From the Synnel root directory
cd examples/chat
bun install
```

### Running the Example

```bash
# Run both server and client
bun run dev
```

This will start:

- **Server** on `http://localhost:3001` (HTTP + WebSocket)
- **Client** on `http://localhost:3000`

### Individual Commands

```bash
# Run server only
bun run server

# Run client only
bun run client

# Build for production
bun run build
```

## Usage

1. Open your browser to `http://localhost:3000`
2. Enter a username to join the chat
3. Start messaging!

Open multiple browser tabs to test real-time communication between different users.

## Key Concepts Demonstrated

### Server-side (Express Integration)

```typescript
import express from 'express'
import { createServer } from 'http'
import { Synnel } from '@synnel/server'

const app = express()
const httpServer = createServer(app)

// Initialize Synnel with Express server
const synnel = new Synnel({ server: httpServer })

// Create multicast channels (returns Promise)
const chat = await synnel.multicast<ChatMessage>('chat')
const presence = await synnel.multicast<PresenceMessage>('presence')
const notifications = synnel.broadcast<NotificationMessage>()

// Handle incoming messages (no manual relay needed - automatic)
chat.receive((data, client) => {
  console.log(`[Chat] ${data.user}: ${data.text}`)
})

// Handle presence updates
presence.receive((data, client) => {
  console.log(`[Presence] ${data.username}: ${data.status}`)
})

// Connection events with live user count
synnel.on('connection', (client) => {
  const userCount = synnel.getStats().clientCount
  notifications.send({
    type: 'info',
    message: `Users online: ${userCount}`,
    timestamp: Date.now(),
  })
})

// Start the server
await synnel.start()
httpServer.listen(3001)
```

### Client-side (React with onMessage callbacks)

```typescript
// Create client outside component (prevents Strict Mode issues)
const client = createSynnelClient({
  transport: new WebSocketClientTransport({
    url: 'ws://localhost:3001/synnel'
  }),
  autoConnect: true,
})

// Wrap app with provider
<SynnelProvider client={client}>
  <App />
</SynnelProvider>

// Use channels with onMessage in options (no race conditions!)
const chat = useChannel<ChatMessage>('chat', {
  onMessage: (data) => {
    setMessages((prev) => [...prev, data])
  }
})

const presence = useChannel<PresenceMessage>('presence', {
  onMessage: (data) => {
    if (data.status === 'typing') {
      setTypingUsers((prev) => [...prev, data.username])
    }
  }
})

// Send messages
chat.send({ text: 'Hello!', user: username, type: 'message' })
```

## Channels Used

1. **chat** (multicast) - Main chat messages, relayed to all subscribers except sender
2. **notifications** (broadcast) - Server announcements and user count updates
3. **presence** (multicast) - User status (online, offline, typing indicators)

## API Highlights

### Server API

| Method                                | Description                                |
| ------------------------------------- | ------------------------------------------ |
| `new Synnel({ server })`              | Attach to existing Express server          |
| `new Synnel({ port })`                | Create standalone server on port           |
| `await synnel.multicast(name)`        | Create multicast channel (returns Promise) |
| `synnel.broadcast()`                  | Create broadcast channel                   |
| `channel.receive(handler)`            | Handle incoming messages                   |
| `channel.send(data, excludeId?)`      | Send to all (optionally exclude sender)    |
| `synnel.on('connection', handler)`    | Handle new connections                     |
| `synnel.on('disconnection', handler)` | Handle disconnections                      |
| `synnel.getStats()`                   | Get server statistics                      |

### Client React API

| Hook/Method                       | Description                                 |
| --------------------------------- | ------------------------------------------- |
| `useChannel(name, { onMessage })` | Subscribe with callback (no race condition) |
| `useBroadcast({ onMessage })`     | Subscribe to broadcast channel              |
| `channel.send(data)`              | Send data to channel                        |
| `client.subscribe(channel)`       | Subscribe to channel                        |
| `client.publish(channel, data)`   | Publish data to channel                     |

## License

MIT
