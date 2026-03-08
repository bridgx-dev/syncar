# @synca/server

> Node.js WebSocket server for real-time synchronization with pub/sub broadcasting and composable middleware.

[![npm version](https://badge.fury.io/js/%40synca%2Fserver.svg)](https://www.npmjs.com/package/@synca/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Real-time WebSocket Communication** - Fast, bidirectional messaging powered by `ws`.
- **Composable Middleware** - Hono-style middleware for auth, logging, rate limiting, and more.
- **Broadcast & Multicast Channels** - Topic-based messaging patterns with automatic chunking.
- **Handshake Authentication** - Dedicated hook for authenticating clients during connection.
- **Type-Safe API** - Full TypeScript support for messages, context, and state.
- **Automatic Chunking** - Handles high-volume broadcasts without blocking the event loop.

## Installation

```bash
npm install @synca/server
```

## Quick Start

```typescript
import { createSyncaServer } from '@synca/server'

const server = createSyncaServer({ port: 3000 })

// 1. Add Middleware
server.use(async (c, next) => {
  console.log(`[${c.req.action}] client:${c.req.client?.id}`)
  await next()
})

// 2. Create Channels
const chat = server.createMulticast<string>('chat')

// Optional: Custom message handling (disables auto-relay)
chat.onMessage((data, client) => {
  console.log(`Received: ${data}`)
  chat.publish(`User said: ${data}`, { exclude: [client.id] })
})

// 3. Start Server
await server.start()
```

## Middleware

Synca uses a powerful middleware system inspired by Hono. Middleware can intercept `connect`, `disconnect`, `message`, `subscribe`, and `unsubscribe` actions.

### Built-in Middleware

```typescript
import { 
  createAuthMiddleware, 
  createLoggingMiddleware, 
  createRateLimitMiddleware 
} from '@synca/server'

// Global Auth
server.use(createAuthMiddleware({
  verifyToken: async (token) => ({ id: '123', name: 'User' })
}))

// Channel-specific Middleware
const adminChannel = server.createMulticast('admin')
adminChannel.use(async (c, next) => {
  if (c.get('user')?.role !== 'admin') {
    return c.reject('Unauthorized')
  }
  await next()
})
```

## Handshake Authentication

Validate clients before the WebSocket connection is even established.

```typescript
server.authenticate(async (request) => {
  const token = request.headers['authorization']
  if (!token) throw new Error('Missing token')
  
  const userId = await verify(token)
  return userId // This becomes the client.id
})
```

## Channels

### Broadcast Channel
Sends messages to **all** connected clients. No subscription needed.

```typescript
const broadcast = server.createBroadcast<string>()
broadcast.publish('Global alert!')
```

### Multicast Channel
Topic-based messaging for **subscribed** clients.

```typescript
const room = server.createMulticast<string>('room-1')

// Manual subscription
room.subscribe('client-id')

// Message handling (with auto-relay if no handler is set)
room.onMessage((data, client) => {
  // data is typed
})
```

## API Reference

### Server API
| Method | Description |
| :--- | :--- |
| `start()` | Starts the server. |
| `stop()` | Stops the server. |
| `use(middleware)` | Registers global middleware. |
| `authenticate(hook)` | Sets the handshake authentication hook. |
| `createBroadcast<T>()` | Gets/creates the global broadcast channel. |
| `createMulticast<T>(name)` | Gets/creates a named multicast channel. |
| `getStats()` | Returns active clients, channels, and subscriptions. |

### Channel API
| Method | Description |
| :--- | :--- |
| `publish(data, options?)` | Sends message to subscribers. |
| `onMessage(handler)` | Registers a custom message handler. |
| `use(middleware)` | Registers channel-specific middleware. |
| `subscribe(clientId)` | Manually subscribes a client. |
| `unsubscribe(clientId)` | Manually unsubscribes a client. |

## License

MIT
