# @syncar/server

> **High-performance WebSocket server for real-time synchronization.** Build scalable, type-safe, and middleware-driven real-time applications with ease.

[![npm version](https://img.shields.io/npm/v/@syncar/server.svg)](https://www.npmjs.com/package/@syncar/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/Coverage-97%25-brightgreen.svg)](https://github.com/bridgx-dev/syncar)

---

## 🚀 Overview

`@syncar/server` is a robust WebSocket server implementation designed for modern Node.js environments. It provides a unified API for channel management, powerful Onion-style middleware support, and automatic performance optimizations like chunked broadcasting.

## ✨ Features

- **Unified Channel API** – Simplified topic-based messaging (Broadcast & Multicast).
- **Onion Middleware** – Composable middleware pipeline for Auth, Logging, Rate Limiting.
- **Full Type Safety** – Built with TypeScript for a rock-solid developer experience.
- **Handshake Authentication** – Secure connections before the WebSocket upgrade.
- **Event-Driven** – Rich lifecycle events for fine-grained control.
- **Performance First** – Automatic chunking for high-volume broadcasts to keep the event loop smooth.

## 💡 Use Cases

- **Real-time Chat** – Build multi-room chat applications with user presence and typing indicators.
- **Live Notifications** – Push system alerts, activity feeds, and social updates instantly.
- **Collaborative Apps** – Synchronize state for shared whiteboards, document editors, or project boards.
- **Interactive Dashboards** – Stream live analytics, stock prices, or IoT sensor data to multiple clients.
- **Gaming** – Handle low-latency game state synchronization and player coordination.

## 📦 Installation

```bash
npm install @syncar/server
```

## 🏁 Quick Start

### Basic Server Setup

```typescript
import { createSyncarServer } from '@syncar/server'

// 1. Initialize the server
const server = createSyncarServer({ port: 3000 })

// 2. Define a channel
const chat = server.createChannel<{ user: string; text: string }>('chat')

// 3. Handle messages
chat.onMessage((data, client) => {
    console.log(`${data.user}: ${data.text}`)
    // Relay to all subscribers except the sender
    chat.publish(data, [client.id])
})

// 4. Start listening
server.start()
console.log('Syncar server running on port 3000')
```

### With Existing HTTP/Express Server

```typescript
import express from 'express'
import { createServer } from 'http'
import { createSyncarServer } from '@syncar/server'

const app = express()
const httpServer = createServer(app)

const server = createSyncarServer({
    server: httpServer,
    path: '/ws',
})

server.start()
httpServer.listen(3000)
```

## 📢 Broadcasting

Syncar makes it easy to send messages to all connected clients effortlessly.

### Global Broadcast

Send a message to every single client connected to the server, regardless of their channel subscriptions.

```typescript
// Send to everyone
server.broadcast({
    type: 'system_alert',
    message: 'Server maintenance in 5 minutes',
})
```

### Channel Broadcast

Send a message to all subscribers of a specific channel.

```typescript
const news = server.createChannel('news')

// Everyone in 'news' will receive this
news.publish({ title: 'New Update Available!' })
```

## 🛡️ Middleware

Syncar's middleware system is inspired by frameworks like Koa and Hono.

### Global & Channel Middleware

```typescript
// Global middleware - runs for every action
server.use(async (c, next) => {
    const start = Date.now()
    await next()
    console.log(`${c.req.action} took ${Date.now() - start}ms`)
})

// Channel-specific middleware
const adminChannel = server.createChannel('admin')
adminChannel.use(async (c, next) => {
    if (c.get('user')?.role !== 'admin') {
        return c.reject('Admin access required')
    }
    await next()
})
```

## 📖 API Reference

### Server Instance

| Method                            | Description                                          |
| :-------------------------------- | :--------------------------------------------------- |
| `start()`                         | Starts the server and begins accepting connections.  |
| `stop()`                          | Gracefully shuts down the server.                    |
| `createChannel<T>(name, options)` | Creates/retrieves a channel with specified options.  |
| `broadcast(data)`                 | Sends a message to all connected clients globally.   |
| `use(middleware)`                 | Registers a global middleware function.              |
| `getStats()`                      | Returns metrics (client count, channel count, etc.). |

### Channel Instance

| Method                    | Description                                        |
| :------------------------ | :------------------------------------------------- |
| `publish(data, exclude?)` | Publishes data to all subscribers in the channel.  |
| `subscribe(clientId)`     | Manually subscribes a client to the channel.       |
| `unsubscribe(clientId)`   | Unsubscribes a client from the channel.            |
| `onMessage(handler)`      | Registers a listener for incoming client messages. |
| `use(middleware)`         | Registers a channel-specific middleware.           |

## 🧪 Testing

We take reliability seriously. Syncar is backed by a comprehensive test suite.

```bash
npm test                # Run all tests
npm run test:coverage   # Generate coverage report
```

Current statistics: **347+ tests passed**, **97% statement coverage**.

## 📄 License

MIT © [Bridgx](https://github.com/bridgx-dev)
