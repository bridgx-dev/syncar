# @syncar/server

> Node.js WebSocket server for real-time synchronization with pub/sub broadcasting and composable middleware.

[![npm version](https://badge.fury.io/js/%40syncar%2Fserver.svg)](https://www.npmjs.com/package/@syncar/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Coverage: 97.49%](https://img.shields.io/badge/Coverage-97.49%25-brightgreen)](https://github.com/yourusername/syncar)

## Features

- **Real-time WebSocket Communication** - Fast, bidirectional messaging powered by `ws`
- **Composable Middleware** - Hono-style middleware for auth, logging, rate limiting, and more
- **Broadcast & Multicast Channels** - Topic-based messaging patterns with automatic chunking
- **Handshake Authentication** - Dedicated hook for authenticating clients during connection
- **Type-Safe API** - Full TypeScript support with comprehensive types
- **Automatic Chunking** - Handles high-volume broadcasts without blocking the event loop
- **Event-Driven Architecture** - Rich event system for connection lifecycle management

## Installation

```bash
npm install @syncar/server
```

## Quick Start

### Basic Server

```typescript
import { createSyncarServer } from '@syncar/server'

// Create server with default configuration
const server = createSyncarServer({ port: 3000 })

// Start the server
await server.start()

// Create a broadcast channel (sends to all connected clients)
const broadcast = server.createBroadcast<string>()
broadcast.publish('Server started!')

// Create a multicast channel (sends to subscribed clients only)
const chat = server.createMulticast<{ text: string; user: string }>('chat')

// Handle incoming messages from clients
chat.onMessage((data, client) => {
  console.log(`Received from ${client.id}:`, data.text)
  // Relay to all subscribers except sender
  chat.publish(data, { exclude: [client.id] })
})
```

### With Express

```typescript
import express from 'express'
import { createServer } from 'http'
import { Syncar } from '@syncar/server'

const app = express()
const httpServer = createServer(app)

// Attach Syncar to existing HTTP server
const server = new Syncar({ server: httpServer })

await server.start()

httpServer.listen(3000)
```

### With Custom Configuration

```typescript
import { createSyncarServer } from '@syncar/server'

const server = createSyncarServer({
  port: 3000,
  host: '0.0.0.0',
  path: '/ws', // WebSocket endpoint path
  enablePing: true, // Enable automatic ping/pong
  pingInterval: 30000, // Ping every 30 seconds
  pingTimeout: 5000, // Wait 5 seconds for pong
  broadcastChunkSize: 500, // Chunk broadcasts into groups of 500
})

await server.start()
```

## Middleware

Syncar uses a powerful middleware system inspired by Hono. Middleware can intercept `connect`, `disconnect`, `message`, `subscribe`, and `unsubscribe` actions.

### Adding Middleware

```typescript
import { createSyncarServer } from '@syncar/server'

const server = createSyncarServer({ port: 3000 })

// Add custom middleware
server.use(async (c, next) => {
  console.log(`[${c.req.action}] client: ${c.req.client?.id}`)
  await next()
})

await server.start()
```

### Built-in Middleware

#### Authentication Middleware

```typescript
import { createSyncarServer, createAuthMiddleware } from '@syncar/server'

const server = createSyncarServer({
  port: 3000,
  middleware: [
    createAuthMiddleware({
      verifyToken: async (token) => {
        // Verify JWT or any token
        const user = await verifyJwt(token)
        return { id: user.sub, email: user.email, role: user.role }
      },
      getToken: (context) => {
        // Extract token from message data
        return context.message?.data?.token
      },
      attachProperty: 'user', // Property name on client object
    }),
  ],
})

// Access authenticated user in message handlers
chat.onMessage((data, client) => {
  const user = (client as any).user
  console.log(`Message from ${user.email}:`, data)
})
```

#### Logging Middleware

```typescript
import { createLoggingMiddleware } from '@syncar/server'

const server = createSyncarServer({
  port: 3000,
  middleware: [
    createLoggingMiddleware({
      logger: console,
      logLevel: 'info',
      includeMessageData: false,
      format: (context) => {
        return `[${context.action}] ${context.clientId} - ${context.channel}`
      },
    }),
  ],
})
```

#### Rate Limiting Middleware

```typescript
import { createRateLimitMiddleware } from '@syncar/server'

const server = createSyncarServer({
  port: 3000,
  middleware: [
    createRateLimitMiddleware({
      maxRequests: 100, // Max requests per window
      windowMs: 60000, // 1 minute window
      actions: ['message'], // Rate limit message actions only
    }),
  ],
})
```

#### Channel Whitelist Middleware

```typescript
import { createChannelWhitelistMiddleware } from '@syncar/server'

const server = createSyncarServer({
  port: 3000,
  middleware: [
    createChannelWhitelistMiddleware({
      // Static list of allowed channels
      allowedChannels: ['chat', 'notifications', 'presence'],

      // Or use dynamic function
      isDynamic: (channel, client) => {
        const user = (client as any).user
        return user?.permissions?.includes(channel)
      },
    }),
  ],
})
```

### Channel-Specific Middleware

```typescript
// Add middleware to a specific channel only
const adminChannel = server.createMulticast('admin')

adminChannel.use(async (c, next) => {
  const user = c.get('user')
  if (user?.role !== 'admin') {
    return c.reject('Unauthorized: Admin access required')
  }
  await next()
})
```

## Handshake Authentication

Validate clients before the WebSocket connection is established:

```typescript
import { createSyncarServer } from '@syncar/server'

const server = createSyncarServer({ port: 3000 })

// Set handshake authentication hook
server.authenticate(async (request) => {
  const token = request.headers['authorization']?.replace('Bearer ', '')

  if (!token) {
    throw new Error('Authentication required')
  }

  // Verify token and return client ID
  const userId = await verifyToken(token)
  return userId // This becomes the client.id
})

await server.start()
```

## Channels

### Broadcast Channel

Sends messages to **all** connected clients automatically. No subscription required.

```typescript
const broadcast = server.createBroadcast<string>()

// Send to all clients
await broadcast.publish('Server maintenance in 5 minutes')

// Send to all except specific clients
await broadcast.publish('Admin message', {
  exclude: ['client-123', 'client-456'],
})

// Send to specific clients only
await broadcast.publish('Private message', {
  to: ['client-1', 'client-2'],
})
```

### Multicast Channel

Topic-based messaging for **subscribed** clients only. Clients must explicitly subscribe to receive messages.

```typescript
interface ChatMessage {
  text: string
  user: string
  timestamp: number
}

const chat = server.createMulticast<ChatMessage>('chat')

// Handle incoming messages
chat.onMessage((data, client) => {
  console.log(`${client.id}: ${data.text}`)

  // Echo back to sender only
  chat.publish(data, { to: [client.id] })

  // Or broadcast to all except sender
  chat.publish(data, { exclude: [client.id] })
})

// Publish from server
await chat.publish({
  text: 'Welcome!',
  user: 'System',
  timestamp: Date.now(),
})
```

### Channel Options

```typescript
// Check if channel exists
if (server.hasChannel('chat')) {
  console.log('Chat channel exists')
}

// Get all active channel names
const channels = server.getChannels()
console.log('Active channels:', channels)
// ['chat', 'notifications', 'presence']

// Manually subscribe a client (server-side)
chat.subscribe('client-id')

// Manually unsubscribe a client
chat.unsubscribe('client-id')
```

## Server Management

### Server Lifecycle

```typescript
// Start the server
await server.start()

// Check server statistics
const stats = server.getStats()
console.log({
  clientCount: stats.clientCount,
  channelCount: stats.channelCount,
  subscriptionCount: stats.subscriptionCount,
  startedAt: stats.startedAt,
})

// Stop the server (closes all connections)
await server.stop()
```

### Server Configuration

```typescript
// Get read-only configuration
const config = server.getConfig()
console.log(`Server running on port ${config.port}`)

// Access the client registry directly
const registry = server.getRegistry()
const client = registry.get('client-123')
if (client) {
  console.log(`Client connected at: ${client.connectedAt}`)
}
```

### Custom Logger

```typescript
import { createSyncarServer } from '@syncar/server'

const server = createSyncarServer({
  port: 3000,
  logger: {
    debug: (msg, ...args) => console.debug('[DEBUG]', msg, ...args),
    info: (msg, ...args) => console.info('[INFO]', msg, ...args),
    warn: (msg, ...args) => console.warn('[WARN]', msg, ...args),
    error: (msg, ...args) => console.error('[ERROR]', msg, ...args),
  },
})
```

## Error Handling

Syncar provides built-in error types for handling different scenarios:

```typescript
import {
  SyncarError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  ValidationError,
  StateError,
  MiddlewareRejectionError,
} from '@syncar/server'

try {
  await server.start()
} catch (error) {
  if (error instanceof ConfigError) {
    console.error('Server configuration error:', error.message)
  } else if (error instanceof TransportError) {
    console.error('WebSocket transport error:', error.message)
  } else if (error instanceof StateError) {
    console.error('Server state error:', error.message)
  }
}
```

## API Reference

### Server Methods

| Method                     | Description                                 |
| :------------------------- | :------------------------------------------ |
| `start()`                  | Starts the WebSocket server                 |
| `stop()`                   | Stops the server and closes all connections |
| `use(middleware)`          | Registers global middleware                 |
| `authenticate(hook)`       | Sets handshake authentication hook          |
| `createBroadcast<T>()`     | Gets/creates the global broadcast channel   |
| `createMulticast<T>(name)` | Gets/creates a named multicast channel      |
| `hasChannel(name)`         | Checks if a channel exists                  |
| `getChannels()`            | Returns all active channel names            |
| `getStats()`               | Returns server statistics                   |
| `getConfig()`              | Returns read-only server configuration      |
| `getRegistry()`            | Returns the client registry                 |

### BroadcastChannel Methods

| Method                    | Description                            |
| :------------------------ | :------------------------------------- |
| `publish(data, options?)` | Sends message to all connected clients |
| `onMessage(handler)`      | Registers a custom message handler     |
| `use(middleware)`         | Registers channel-specific middleware  |
| `subscribe(clientId)`     | Manually subscribes a client           |
| `unsubscribe(clientId)`   | Manually unsubscribes a client         |
| `getState()`              | Returns channel state information      |

### MulticastChannel Methods

| Method                    | Description                           |
| :------------------------ | :------------------------------------ |
| `publish(data, options?)` | Sends message to all subscribers      |
| `onMessage(handler)`      | Registers a custom message handler    |
| `use(middleware)`         | Registers channel-specific middleware |
| `subscribe(clientId)`     | Manually subscribes a client          |
| `unsubscribe(clientId)`   | Manually unsubscribes a client        |
| `getState()`              | Returns channel state information     |

### Server Options

| Option               | Type            | Default     | Description                |
| :------------------- | :-------------- | :---------- | :------------------------- |
| `port`               | `number`        | `3000`      | Port to listen on          |
| `host`               | `string`        | `'0.0.0.0'` | Host to bind to            |
| `path`               | `string`        | `'/syncar'` | WebSocket endpoint path    |
| `server`             | `Server`        | `undefined` | Existing HTTP/HTTPS server |
| `enablePing`         | `boolean`       | `true`      | Enable automatic ping/pong |
| `pingInterval`       | `number`        | `30000`     | Ping interval in ms        |
| `pingTimeout`        | `number`        | `5000`      | Ping timeout in ms         |
| `broadcastChunkSize` | `number`        | `500`       | Broadcast chunk size       |
| `logger`             | `ILogger`       | `console`   | Custom logger instance     |
| `middleware`         | `IMiddleware[]` | `[]`        | Global middleware array    |

## Testing

The `@syncar/server` package has comprehensive test coverage with **401 tests** across **12 test files**.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run dev

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Coverage

| Metric         | Coverage |
| :------------- | :------- |
| **Statements** | 97.49%   |
| **Branches**   | 95.85%   |
| **Functions**  | 95.91%   |
| **Lines**      | 97.49%   |

### Coverage by Module

| File           | Statements | Branches | Functions | Lines  |
| :------------- | :--------- | :------- | :-------- | :----- |
| `channel.ts`   | 97.34%     | 92.30%   | 90.90%    | 97.34% |
| `compose.ts`   | 100%       | 100%     | 100%      | 100%   |
| `config.ts`    | 100%       | 100%     | 100%      | 100%   |
| `context.ts`   | 100%       | 97.29%   | 100%      | 100%   |
| `errors.ts`    | 100%       | 94.11%   | 100%      | 100%   |
| `index.ts`     | 100%       | 100%     | 100%      | 100%   |
| `registry.ts`  | 100%       | 100%     | 100%      | 100%   |
| `server.ts`    | 95.53%     | 91.17%   | 100%      | 95.53% |
| `types.ts`     | 100%       | 100%     | 100%      | 100%   |
| `utils.ts`     | 100%       | 100%     | 100%      | 100%   |
| `websocket.ts` | 80.37%     | 88.88%   | 55.55%    | 80.37% |
| `handlers/`    | 98.24%     | 96.77%   | 100%      | 98.24% |
| `middleware/`  | 100%       | 94.64%   | 100%      | 100%   |

### Test Files

| Test File            | Tests | Description                        |
| :------------------- | :---- | :--------------------------------- |
| `registry.test.ts`   | 45    | Client registry management         |
| `handlers.test.ts`   | 39    | Message and connection handlers    |
| `server.test.ts`     | 31    | Server lifecycle and configuration |
| `channel.test.ts`    | 46    | Broadcast and multicast channels   |
| `websocket.test.ts`  | 25    | WebSocket transport layer          |
| `context.test.ts`    | 37    | Middleware context execution       |
| `utils.test.ts`      | 41    | Utility functions                  |
| `middleware.test.ts` | 51    | Built-in middleware factories      |
| `errors.test.ts`     | 37    | Error types and handling           |
| `compose.test.ts`    | 17    | Middleware composition             |
| `config.test.ts`     | 21    | Configuration constants            |
| `index.test.ts`      | 11    | Public API exports                 |

## License

MIT
