# @synnel/adapter

WebSocket transport adapter for Synnel v2. Provides client and server WebSocket implementations using the native WebSocket API (browser) and the `ws` library (Node.js).

## Overview

This package implements the `Transport` and `ServerTransport` interfaces from `@synnel/core` using WebSocket as the underlying transport layer.

## Installation

```bash
npm install @synnel/adapter
# or
pnpm add @synnel/adapter
# or
yarn add @synnel/adapter
```

**Peer Dependencies:**
- Browser: No additional dependencies (uses native WebSocket)
- Node.js: `ws@^8.0.0`

## Quick Start

### Client-Side

```typescript
import { createWebSocketClientTransport } from '@synnel/adapter/client'
import { createSynnelClient } from '@synnel/client'

const transport = createWebSocketClientTransport({
  url: 'ws://localhost:3000',
  reconnect: true,
})

const client = createSynnelClient({ transport })
await client.connect()
```

### Server-Side (Standalone)

```typescript
import { createWebSocketServerTransport } from '@synnel/adapter/server'
import { createSynnelServer } from '@synnel/server'

const transport = createWebSocketServerTransport({
  port: 3000,
  path: '/synnel',
})

const server = createSynnelServer({ transport })
await server.start()
```

### Server-Side (Attached to Express)

```typescript
import express from 'express'
import { createServer } from 'http'
import { createWebSocketServerTransport } from '@synnel/adapter/server'

const app = express()
const httpServer = createServer(app)

// Attach WebSocket to existing HTTP server
const transport = createWebSocketServerTransport({
  server: httpServer,
  path: '/synnel',
})

// Start your HTTP server
httpServer.listen(3000)

// Start the WebSocket transport
await transport.start()

// Now you can use both HTTP and WebSocket on the same port
app.get('/api', (req, res) => res.json({ status: 'ok' }))
```

### Server-Side (Attached to Fastify)

```typescript
import Fastify from 'fastify'
import { createWebSocketServerTransport } from '@synnel/adapter/server'

const fastify = Fastify()

await fastify.listen({ port: 3000 })

// Attach WebSocket to Fastify server
const transport = createWebSocketServerTransport({
  server: fastify.server,
  path: '/synnel',
})

await transport.start()
```

## API Reference

### Client Transport

#### `createWebSocketClientTransport(config)`

Creates a new WebSocket client transport.

```typescript
import { createWebSocketClientTransport } from '@synnel/adapter/client'

const transport = createWebSocketClientTransport({
  url: 'ws://localhost:3000',
  reconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  connectionTimeout: 10000,
})
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | *required* | WebSocket server URL |
| `reconnect` | `boolean` | `false` | Enable automatic reconnection |
| `maxReconnectAttempts` | `number` | `5` | Maximum reconnection attempts |
| `reconnectDelay` | `number` | `1000` | Initial reconnection delay (ms) |
| `maxReconnectDelay` | `number` | `30000` | Maximum reconnection delay (ms) |
| `connectionTimeout` | `number` | `10000` | Connection timeout (ms) |
| `protocols` | `string \| string[]` | `undefined` | WebSocket protocols |
| `WebSocketConstructor` | `typeof WebSocket` | `WebSocket` | Custom WebSocket constructor |

**Methods:**

- `connect(): Promise<void>` - Connect to the server
- `disconnect(): Promise<void>` - Disconnect from the server
- `send(message: Message): Promise<void>` - Send a message
- `on(event, handler): () => void` - Register event handler
- `getConnectionInfo(): object` - Get connection info

**Events:**

- `open` - Connection established
- `message` - Message received
- `error` - Error occurred
- `close` - Connection closed

### Server Transport

#### `createWebSocketServerTransport(config?)`

Creates a new WebSocket server transport.

```typescript
import { createWebSocketServerTransport } from '@synnel/adapter/server'

const server = createWebSocketServerTransport({
  port: 3000,
  host: '0.0.0.0',
  path: '/synnel',
  maxPayload: 1048576,
  enablePing: true,
  pingInterval: 30000,
  pingTimeout: 5000,
})
```

**Config Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | `object` | `undefined` | Existing HTTP server to attach to (Express, Fastify, etc.) |
| `port` | `number` | `3000` | Server port (only used if `server` is not provided) |
| `host` | `string` | `'0.0.0.0'` | Server host (only used if `server` is not provided) |
| `path` | `string` | `'/synnel'` | WebSocket path |
| `maxPayload` | `number` | `1048576` | Max message size (bytes) |
| `enablePing` | `boolean` | `true` | Enable ping/pong |
| `pingInterval` | `number` | `30000` | Ping interval (ms) |
| `pingTimeout` | `number` | `5000` | Ping timeout (ms) |

**Methods:**

- `start(): Promise<void>` - Start the server
- `stop(): Promise<void>` - Stop the server
- `sendToClient(clientId, message): Promise<void>` - Send to specific client
- `broadcast(message): Promise<void>` - Send to all clients
- `disconnectClient(clientId, code?, reason?): Promise<void>` - Disconnect client
- `getClients(): ClientConnection[]` - Get all clients
- `getClient(clientId): ClientConnection \| undefined` - Get specific client
- `on(event, handler): () => void` - Register event handler
- `getServerInfo(): object` - Get server info

**Events:**

- `connection` - New client connected
- `disconnection` - Client disconnected
- `message` - Message received from client
- `error` - Error occurred
- `listening` - Server started listening

## Advanced Usage

### Custom WebSocket Constructor

```typescript
// For testing or custom implementations
import { createWebSocketClientTransport } from '@synnel/adapter/client'

class CustomWebSocket extends WebSocket {
  // Custom implementation
}

const transport = createWebSocketClientTransport({
  url: 'ws://localhost:3000',
  WebSocketConstructor: CustomWebSocket,
})
```

### Event Handling

```typescript
import { createWebSocketServerTransport } from '@synnel/adapter/server'

const server = createWebSocketServerTransport({ port: 3000 })

server.on('connection', (clientId) => {
  console.log(`Client connected: ${clientId}`)
})

server.on('disconnection', (clientId, event) => {
  console.log(`Client disconnected: ${clientId}`, event)
})

server.on('message', (clientId, message) => {
  console.log(`Message from ${clientId}:`, message)
})

await server.start()
```

## License

MIT
