# Synnel Chat Example V2

A full-stack chat application demonstrating the Synnel V2 real-time messaging framework with Express.js integration.

## Features

- **Real-time messaging** using WebSockets
- **Express.js integration** - Synnel V2 attaches to your existing HTTP server
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

- `@synca/server` - WebSocket server V2 with Express integration
- `@synca/types` - Core types and protocols
- Express.js - HTTP server
- Node.js + TypeScript

### Client

- `@synca/react` - React hooks and provider
- `@synca/client` - Core client
- React 19 + Vite

## Project Structure

```
chat/
├── server/
│   └── index.ts          # WebSocket server V2 with Express
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

## V2 API Changes

The server has been updated to use the new V2 API:

### Server API Changes (V1 → V2)

| V1                             | V2                                                      |
| ------------------------------ | ------------------------------------------------------- |
| `new Synnel({ server })`       | `createSynnelServer({ server })`                        |
| `await synnel.multicast(name)` | `server.createMulticast(name)` (after `server.start()`) |
| `synnel.broadcast()`           | `server.createBroadcast()` (after `server.start()`)     |
| `channel.receive()`            | `channel.onMessage()` or `channel.receive()`            |
| Messages auto-relayed          | **Must explicitly call** `channel.publish()`            |

### Key V2 Server API

```typescript
import express from 'express'
import { createServer } from 'http'
import { createSynnelServer } from '@synca/server'

const app = express()
const httpServer = createServer(app)

// Initialize Synnel V2 server
const server = createSynnelServer({ server: httpServer })

// Start server first (required before creating channels)
await server.start()

// Create multicast channels
const chat = server.createMulticast<ChatMessage>('chat')
const presence = server.createMulticast<PresenceMessage>('presence')
const notifications = server.createBroadcast<NotificationMessage>()

// Handle incoming messages with onMessage
// V2: Messages are NOT auto-relayed - you must explicitly publish
chat.onMessage(async (data, client) => {
  console.log(`[Chat] ${data.user}: ${data.text}`)

  // Explicitly publish to all subscribers
  chat.publish(data)
})

// Or use receive() (same as onMessage)
chat.receive(async (data, client) => {
  // Handle message
  chat.publish(data)
})

// Connection events
server.on('connection', (client) => {
  const stats = server.getStats()
  notifications.publish({
    type: 'info',
    message: `Users online: ${stats.clientCount}`,
    timestamp: Date.now(),
  })
})

// Authorization
server.authorize(async (clientId, channel, action) => {
  return true // Allow all
})

// Global message interceptor
server.onMessage((client, message) => {
  console.log(`[Message] ${client.id} sent:`, message)
})
```

## Channels Used

1. **chat** (multicast) - Main chat messages
2. **notifications** (broadcast) - Server announcements and user count updates
3. **presence** (multicast) - User status (online, offline, typing indicators)

## V2 Architecture Notes

### Key Changes in V2:

1. **Factory Pattern**: Use `createSynnelServer()` instead of `new Synnel()`
2. **Start Before Channels**: Must call `server.start()` before creating channels
3. **Explicit Message Publishing**: Messages are NOT auto-relayed - call `channel.publish()` explicitly
4. **Handler Registration**: Use `channel.onMessage()` or `channel.receive()` to handle incoming messages
5. **Proper Types**: All types from `@synca/types` and `@synca/server` directories

### Message Flow in V2:

```typescript
// 1. Client sends message
// 2. Server receives via WebSocket transport
// 3. MessageHandler routes to channel
// 4. Channel's registered onMessage handler is called
// 5. Handler explicitly publishes to channel
// 6. All subscribers receive the message
```

## License

MIT
