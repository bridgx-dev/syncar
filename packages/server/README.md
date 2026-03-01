# @synnel/server

> Node.js WebSocket server for real-time synchronization with pub/sub broadcasting.

[![npm version](https://badge.fury.io/js/%40synnel%2Fserver.svg)](https://www.npmjs.com/package/@synnel/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Real-time WebSocket Communication** - Fast, bidirectional messaging using the `ws` library
- **Broadcast & Multicast Channels** - Server-to-all and topic-based messaging patterns
- **Middleware System** - Composable middleware for authentication, logging, rate limiting, and more
- **Type-Safe API** - Full TypeScript support with comprehensive type definitions
- **Event-Driven Architecture** - Rich event system for connection lifecycle and custom events
- **Connection Management** - Automatic connection tracking, ping/pong keepalive, and graceful shutdown
- **Flexible Transport Layer** - Pluggable transport interface for custom implementations
- **Authorization Hook** - Built-in authorization handler for connection/subscription/message actions
- **Chunked Broadcasting** - Configurable chunking for high-volume broadcasts to avoid event loop blocking
- **Client Registry** - Centralized client and channel management

## Installation

```bash
npm install @synnel/server ws
# or
yarn add @synnel/server ws
# or
pnpm add @synnel/server ws
```

**Peer Dependencies:** `ws@^8.0.0`

## Quick Start

```typescript
import { createSynnelServer } from '@synnel/server'

// Create and start server
const server = createSynnelServer({ port: 3000 })
await server.start()

// Create a broadcast channel (sends to all connected clients)
const broadcast = server.createBroadcast<string>()
broadcast.publish('Hello everyone!')

// Create a multicast channel (sends to subscribed clients only)
const chat = server.createMulticast<string>('chat')

// Listen for connections
server.on('connection', (client) => {
  console.log(`Client connected: ${client.id}`)
})

// Listen for messages
server.onMessage((client, message) => {
  console.log(`Received from ${client.id}:`, message)
})

// Get server stats
console.log(server.getStats())
// { clientCount: 3, channelCount: 2, subscriptionCount: 5, startedAt: 1699123456789 }
```

## Table of Contents

- [Server Configuration](#server-configuration)
- [Channels](#channels)
- [Middleware](#middleware)
- [Event Handling](#event-handling)
- [Authorization](#authorization)
- [Error Handling](#error-handling)
- [API Reference](#api-reference)
- [Examples](#examples)

---

## Server Configuration

### Basic Configuration

```typescript
import { createSynnelServer } from '@synnel/server'

const server = createSynnelServer({
  port: 3000, // Server port (default: 3000)
  host: '0.0.0.0', // Server host (default: '0.0.0.0')
  path: '/ws', // WebSocket path (default: '/synnel')
  enablePing: true, // Enable ping/pong (default: true)
  pingInterval: 5000, // Ping interval in ms (default: 5000)
  pingTimeout: 5000, // Ping timeout in ms (default: 5000)
  broadcastChunkSize: 500, // Chunk size for broadcasts (default: 500)
})

await server.start()
```

### Using Existing HTTP Server

```typescript
import { createServer } from 'node:http'
import { createSynnelServer } from '@synnel/server'

const httpServer = createServer((req, res) => {
  // Your HTTP logic here
  res.writeHead(200)
  res.end('OK')
})

const server = createSynnelServer({
  server: httpServer,
  path: '/ws',
})

await server.start()
```

### Using with Express

```typescript
import express from 'express'
import { createSynnelServer } from '@synnel/server'

const app = express()
const httpServer = app.listen(3000)

const server = createSynnelServer({
  server: httpServer,
  path: '/ws',
})

await server.start()
```

---

## Channels

Synnel provides two types of channels for different messaging patterns:

### Broadcast Channel

Sends messages to **all connected clients** (no subscription required).

```typescript
const broadcast = server.createBroadcast<string>()

// Send to all clients
broadcast.publish('Server announcement!')

// Send to all except specific clients
broadcast.publish('You are being logged out', {
  exclude: ['client-123', 'client-456'],
})

// Send to specific clients only
broadcast.publish('Private message', {
  to: ['client-1', 'client-2'],
})
```

### Multicast Channel

Sends messages to **subscribed clients only** (topic-based messaging).

```typescript
const chat = server.createMulticast<string>('chat')

// Set up message handler
chat.receive((data, client) => {
  console.log(`${client.id} sent: ${data}`)
})

// Listen for subscriptions
chat.onSubscribe((client) => {
  console.log(`${client.id} joined chat`)
  chat.publish(`Welcome ${client.id}!`)
})

// Listen for unsubscriptions
chat.onUnsubscribe((client) => {
  console.log(`${client.id} left chat`)
})

// Publish to subscribers
chat.publish('Hello chat room!')

// Check if channel exists
server.hasChannel('chat') // true

// Get all channel names
server.getChannels() // ['chat', 'notifications']
```

---

## Middleware

Middleware functions intercept actions (connect, disconnect, message, subscribe, unsubscribe) and can reject or modify behavior.

### Built-in Middleware Factories

#### Authentication Middleware

```typescript
import { createAuthMiddleware } from '@synnel/server'

const authMiddleware = createAuthMiddleware({
  verifyToken: async (token) => {
    // Verify JWT or other token
    const user = await jwt.verify(token, SECRET)
    return { id: user.sub, email: user.email }
  },
  getToken: (context) => {
    // Extract token from message
    return context.message?.data?.token
  },
  attachProperty: 'user',
  actions: ['connect', 'message'], // Require auth for these actions
})

server.use(authMiddleware)
```

#### Logging Middleware

```typescript
import { createLoggingMiddleware } from '@synnel/server'

const loggingMiddleware = createLoggingMiddleware({
  logger: console,
  logLevel: 'info',
  includeMessageData: false,
  actions: ['connect', 'disconnect', 'message', 'subscribe'],
  format: ({ action, clientId, channel }) => {
    return `[${action}] ${clientId} ${channel ? `-> ${channel}` : ''}`
  },
})

server.use(loggingMiddleware)
```

#### Rate Limiting Middleware

```typescript
import { createRateLimitMiddleware } from '@synnel/server'

const rateLimitMiddleware = createRateLimitMiddleware({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  getMessageId: (context) => context.client?.id ?? '',
  actions: ['message'],
})

server.use(rateLimitMiddleware)
```

#### Channel Whitelist Middleware

```typescript
import { createChannelWhitelistMiddleware } from '@synnel/server'

// Static whitelist
const whitelistMiddleware = createChannelWhitelistMiddleware({
  allowedChannels: ['chat', 'notifications'],
})

// Dynamic whitelist with function
const dynamicWhitelist = createChannelWhitelistMiddleware({
  isDynamic: (channel, client) => {
    return client?.permissions?.includes(channel) ?? false
  },
})

server.use(whitelistMiddleware)
```

### Custom Middleware

```typescript
import type { IMiddleware } from '@synnel/server'

const customMiddleware: IMiddleware = async (context) => {
  console.log(`Action: ${context.action}`)

  if (context.action === 'connect') {
    // Check connection validity
    if (!isValidConnection(context.client)) {
      context.reject('Connection not allowed')
    }
  }

  if (context.action === 'message') {
    // Transform or validate message
    console.log('Message:', context.message)
  }
}

server.use(customMiddleware)
```

---

## Event Handling

### Server Events

```typescript
// Connection event
const unsubscribe1 = server.on('connection', (client) => {
  console.log(`Client ${client.id} connected`)
})

// Disconnection event
const unsubscribe2 = server.on('disconnection', (clientId) => {
  console.log(`Client ${clientId} disconnected`)
})

// Error event
const unsubscribe3 = server.on('error', (error) => {
  console.error('Server error:', error)
})

// One-time event handler
server.once('connection', (client) => {
  console.log('First client connected!')
})

// Remove event handler
server.off('connection', handler)

// Emit event locally
server.emit('customEvent', data)
```

### Global Message Handler

```typescript
const unsubscribe = server.onMessage((client, message) => {
  console.log(`Message from ${client.id}:`, message)
})
```

---

## Authorization

The `authorize()` method provides a central authorization hook for connection, subscription, and message actions.

```typescript
server.authorize(async (clientId, channel, action) => {
  // Check if client is admin
  if (channel === 'admin') {
    return await isAdmin(clientId)
  }

  // Check if client is banned
  if (await isBanned(clientId)) {
    return false
  }

  // Allow by default
  return true
})

// Unregister authorization
const unregister = server.authorize(handler)
// Later: unregister()
```

---

## Error Handling

### Error Types

```typescript
import {
  SynnelError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from '@synnel/server'
```

### Error Handling Example

```typescript
server.on('error', (error) => {
  if (error instanceof MiddlewareRejectionError) {
    console.log(`Action rejected: ${error.reason}`)
    console.log(`Action: ${error.action}`)
  } else if (error instanceof ConfigError) {
    console.error('Configuration error:', error.message)
  } else {
    console.error('Unexpected error:', error)
  }
})
```

---

## API Reference

### Server Interface

| Method                     | Description                               |
| -------------------------- | ----------------------------------------- |
| `start()`                  | Start the server                          |
| `stop()`                   | Stop the server and close all connections |
| `createBroadcast<T>()`     | Create a broadcast channel                |
| `createMulticast<T>(name)` | Create or get a multicast channel         |
| `hasChannel(name)`         | Check if a channel exists                 |
| `getChannels()`            | Get all active channel names              |
| `on(event, handler)`       | Register event handler                    |
| `once(event, handler)`     | Register one-time event handler           |
| `off(event, handler)`      | Remove event handler                      |
| `emit(event, ...args)`     | Emit event locally                        |
| `use(middleware)`          | Register middleware                       |
| `authorize(handler)`       | Set authorization handler                 |
| `onMessage(handler)`       | Register global message handler           |
| `getStats()`               | Get server statistics                     |
| `getRegistry()`            | Get client registry                       |
| `getConfig()`              | Get server configuration                  |
| `getEmitter()`             | Get event emitter                         |

### Channel Interface

| Method                        | Description                         |
| ----------------------------- | ----------------------------------- |
| `publish(data, options?)`     | Publish data to subscribers         |
| `receive(handler)`            | Register message handler            |
| `subscribe(clientId)`         | Subscribe a client                  |
| `unsubscribe(clientId)`       | Unsubscribe a client                |
| `onSubscribe(handler)`        | Register subscription handler       |
| `onUnsubscribe(handler)`      | Register unsubscription handler     |
| `hasSubscriber(subscriberId)` | Check if client is subscribed       |
| `getSubscribers()`            | Get all subscribers                 |
| `isEmpty()`                   | Check if channel has no subscribers |
| `subscriberCount`             | Number of subscribers (readonly)    |

---

## Examples

### Complete Chat Server

```typescript
import { createSynnelServer, createLoggingMiddleware } from '@synnel/server'

const server = createSynnelServer({
  port: 3000,
  middleware: [
    createLoggingMiddleware({
      actions: ['connect', 'disconnect', 'subscribe', 'unsubscribe'],
    }),
  ],
})

await server.start()

// Chat channel
const chat = server.createMulticast<{ text: string; user: string }>('chat')

// Handle incoming messages
chat.receive((data, client) => {
  console.log(`${data.user}: ${data.text}`)
  // Broadcast to all subscribers
  chat.publish(data)
})

// Welcome new subscribers
chat.onSubscribe((client) => {
  chat.publish({ text: 'joined the chat', user: client.id })
})

// Announce departures
chat.onUnsubscribe((client) => {
  chat.publish({ text: 'left the chat', user: client.id })
})

// Send periodic announcements
const broadcast = server.createBroadcast<string>()
setInterval(() => {
  broadcast.publish(`Server time: ${new Date().toLocaleTimeString()}`)
}, 60000)
```

### Presence System

```typescript
import { createSynnelServer } from '@synnel/server'

const server = createSynnelServer({ port: 3000 })
await server.start()

const presence = server.createMulticast<{
  id: string
  status: 'online' | 'offline'
}>('presence')

const onlineUsers = new Set<string>()

server.on('connection', (client) => {
  onlineUsers.add(client.id)
  presence.publish({ id: client.id, status: 'online' })
})

server.on('disconnection', (clientId) => {
  onlineUsers.delete(clientId)
  presence.publish({ id: clientId, status: 'offline' })
})

presence.onSubscribe((client) => {
  // Send current online users to new subscriber
  for (const userId of onlineUsers) {
    client.socket.send(
      JSON.stringify({
        type: 'data',
        channel: 'presence',
        data: { id: userId, status: 'online' },
      }),
    )
  }
})
```

---

## Performance Considerations

### Broadcast Chunking

When broadcasting to a large number of subscribers, use `broadcastChunkSize` to avoid blocking the event loop:

```typescript
const server = createSynnelServer({
  broadcastChunkSize: 500, // Process 500 subscribers per tick
})
```

### Memory Management

- The server maintains a registry of clients and channels
- Connections are automatically cleaned up on disconnect
- Rate limiting middleware includes periodic cleanup

---

## License

MIT

---

## Author

M16BAPPI - [m16bappi@gmail.com]

---

## See Also

- [@synnel/client](https://www.npmjs.com/package/@synnel/client) - Client library for Synnel
- [ws](https://github.com/websockets/ws) - WebSocket library
