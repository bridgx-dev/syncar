# Synnel v2 Chat Example

A full-stack chat application demonstrating the Synnel v2 real-time messaging framework.

## Features

- **Real-time messaging** using WebSockets
- **Channel-based communication** (chat, notifications, presence)
- **Broadcast support** for server-wide announcements
- **Typing indicators** using presence channel
- **User presence** (online/offline status)
- **Rate limiting** and logging middleware on server
- **React hooks** for easy integration
- **Beautiful UI** with smooth animations

## Tech Stack

### Server
- `@synnel/server-v2` - WebSocket server
- `@synnel/adapter` - WebSocket transport
- `@synnel/core-v2` - Core types and protocols
- Node.js + TypeScript

### Client
- `@synnel/react-v2` - React hooks and provider
- `@synnel/client-v2` - Core client
- `@synnel/adapter` - WebSocket transport
- React 19 + Vite

## Project Structure

```
chat-v2/
├── server/
│   └── index.ts          # WebSocket server
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
cd examples/chat-v2
bun install
```

### Running the Example

```bash
# Run both server and client
bun run dev
```

This will start:
- **Server** on `ws://localhost:3001`
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

### Server-side

```typescript
// Create server with middleware
const server = createSynnelServer({
  transport,
  channels: ['chat', 'notifications', 'presence'],
  middleware: [
    createLoggingMiddleware({ logConnections: true }),
    createRateLimitMiddleware({ maxMessages: 60, windowMs: 60000 }),
  ],
})

// Get a channel
const chat = server.channel<MessageType>('chat')

// Handle messages
chat.onMessage((data, client) => {
  console.log(`Received:`, data)
})

// Handle events
server.on('connection', (client) => { /* ... */ })
server.on('disconnection', (client, event) => { /* ... */ })
```

### Client-side (React)

```typescript
// Wrap app with provider
<SynnelProvider transport={transport}>
  <App />
</SynnelProvider>

// Use channels in components
const chat = useChannel<MessageType>('chat')
const broadcast = useBroadcast<AnnouncementType>()

// Send messages
chat.send({ text: 'Hello!', user: username })

// Receive messages
useEffect(() => {
  const unsubscribe = chat.onMessage((data) => {
    setMessages((prev) => [...prev, data])
  })
  return unsubscribe
}, [chat])
```

## Channels Used

1. **chat** - Main chat messages
2. **notifications** - Server notifications (welcome, alerts)
3. **presence** - User status (online, offline, typing)
4. **__broadcast__** - Server-wide announcements

## License

MIT
