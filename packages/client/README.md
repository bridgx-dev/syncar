# @synnel/client-v2

Framework-agnostic client for Synnel real-time synchronization. Works with any JavaScript framework or vanilla JS.

## Overview

This package provides a framework-agnostic client for real-time pub/sub communication using the Synnel protocol. It handles:

- Connection management with auto-reconnect
- Channel subscriptions with auto-resubscribe
- Message publishing and receiving
- Event-driven architecture
- TypeScript support

## Installation

```bash
npm install @synnel/client-v2
# or
pnpm add @synnel/client-v2
# or
yarn add @synnel/client-v2
```

## Quick Start

```typescript
import { createSynnelClient } from '@synnel/client-v2'
import { WebSocketClientTransport } from '@synnel/client-v2'

// Create transport
const transport = new WebSocketClientTransport({
  url: 'ws://localhost:3000',
  reconnect: true,
})

// Create client
const client = createSynnelClient({
  transport,
  autoReconnect: true,
})

// Connect
await client.connect()

// Subscribe to a channel
await client.subscribe('chat', {
  onMessage: (msg) => console.log('Received:', msg.data),
  onSubscribed: () => console.log('Subscribed!'),
})

// Publish a message
await client.publish('chat', { text: 'Hello!' })
```

## API Reference

### `createSynnelClient(config)`

Creates a new Synnel client instance.

```typescript
import { createSynnelClient } from '@synnel/client-v2'

const client = createSynnelClient({
  transport: myTransport,
  id: 'my-app', // optional, auto-generated if not provided
  autoConnect: false, // optional, connect immediately
  autoReconnect: true, // optional, auto-reconnect on disconnect
  maxReconnectAttempts: 10, // optional
  reconnectDelay: 1000, // optional, initial delay in ms
  maxReconnectDelay: 30000, // optional, max delay in ms
  debug: true, // optional, enable debug logging
  logger: (level, message, ...args) => {}, // optional, custom logger
})
```

### Client Methods

#### `connect(): Promise<void>`

Connect to the server.

```typescript
await client.connect()
```

#### `disconnect(): Promise<void>`

Disconnect from the server.

```typescript
await client.disconnect()
```

#### `subscribe<T>(channel, callbacks?, options?): Promise<ChannelSubscription>`

Subscribe to a channel.

```typescript
const subscription = await client.subscribe(
  'chat',
  {
    onMessage: (msg) => console.log(msg.data),
    onSubscribed: () => console.log('Subscribed'),
    onUnsubscribed: () => console.log('Unsubscribed'),
    onError: (err) => console.error(err),
  },
  {
    autoResubscribe: true, // Re-subscribe after reconnection
    data: { token: 'abc' }, // Data sent with subscribe message
  },
)
```

#### `unsubscribe(channel): Promise<void>`

Unsubscribe from a channel.

```typescript
await client.unsubscribe('chat')
```

#### `unsubscribeAll(): Promise<void>`

Unsubscribe from all channels.

```typescript
await client.unsubscribeAll()
```

#### `publish<T>(channel, data): Promise<void>`

Publish a message to a channel.

```typescript
await client.publish('chat', { text: 'Hello!' })
```

#### `getSubscription(channel): ChannelSubscription | undefined`

Get a channel subscription.

```typescript
const subscription = client.getSubscription('chat')
console.log(subscription?.state) // 'subscribed' | 'subscribing' | 'unsubscribed' | 'unsubscribing'
```

#### `getSubscribedChannels(): string[]`

Get list of subscribed channels.

```typescript
const channels = client.getSubscribedChannels()
// ['chat', 'notifications']
```

#### `on(event, handler): () => void`

Register an event handler.

```typescript
const unsubscribe = client.on('message', (message) => {
  console.log('Received:', message)
})

// Unsubscribe later
unsubscribe()
```

**Events:**

- `connecting` - Client is connecting
- `connected` - Client connected
- `disconnected` - Client disconnected
- `reconnecting` - Client is reconnecting (includes attempt number)
- `error` - Error occurred
- `message` - Message received

#### `getStats(): ClientStats`

Get client statistics.

```typescript
const stats = client.getStats()
// {
//   status: 'connected',
//   id: 'client_1234567890_abc123',
//   subscriptions: 2,
//   messagesReceived: 42,
//   messagesSent: 15,
//   reconnectAttempts: 0,
//   connectedAt: 1234567890,
//   channels: ['chat', 'notifications']
// }
```

#### `setAutoReconnect(enabled): void`

Enable or disable auto-reconnect.

```typescript
client.setAutoReconnect(false)
```

#### `destroy(): Promise<void>`

Destroy the client and clean up resources.

```typescript
await client.destroy()
```

## Channel Subscription

The `ChannelSubscription` object returned by `subscribe()` has the following properties and methods:

### Properties

- `channel: string` - Channel name
- `state: SubscriptionState` - Current state (`'unsubscribed'` | `'subscribing'` | `'subscribed'` | `'unsubscribing'`)
- `autoResubscribe: boolean` - Whether auto-resubscribe is enabled

### Methods

#### `subscribe(options?): Promise<void>`

Subscribe to the channel.

```typescript
await subscription.subscribe()
```

#### `unsubscribe(): Promise<void>`

Unsubscribe from the channel.

```typescript
await subscription.unsubscribe()
```

#### `onMessage(handler): () => void`

Register a message handler.

```typescript
const unsubscribe = subscription.onMessage((msg) => {
  console.log(msg.data)
})
```

#### `getInfo(): SubscriptionInfo`

Get subscription information.

```typescript
const info = subscription.getInfo()
// {
//   channel: 'chat',
//   state: 'subscribed',
//   autoResubscribe: true,
//   subscribedAt: 1234567890
// }
```

## Framework Examples

### Vanilla JavaScript

```javascript
import { createSynnelClient } from '@synnel/client-v2'
import { WebSocketClientTransport } from '@synnel/client-v2'

const transport = new WebSocketClientTransport({
  url: 'ws://localhost:3000',
})

const client = createSynnelClient({ transport })

await client.connect()

await client.subscribe('chat', {
  onMessage: (msg) => {
    document.getElementById('messages').innerHTML +=
      `<div>${msg.data.text}</div>`
  },
})

document.getElementById('send').onclick = async () => {
  const input = document.getElementById('messageInput')
  await client.publish('chat', { text: input.value })
  input.value = ''
}
```

### Vue.js

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue'
import { createSynnelClient } from '@synnel/client-v2'
import { WebSocketClientTransport } from '@synnel/client-v2'

const messages = ref([])

let client

onMounted(async () => {
  const transport = new WebSocketClientTransport({
    url: 'ws://localhost:3000',
  })

  client = createSynnelClient({ transport })
  await client.connect()

  await client.subscribe('chat', {
    onMessage: (msg) => {
      messages.value.push(msg.data)
    },
  })
})

onUnmounted(async () => {
  await client.destroy()
})

const sendMessage = async () => {
  await client.publish('chat', { text: 'Hello!' })
}
</script>
```

### Svelte

```svelte
<script>
import { onMount, onDestroy } from 'svelte'
import { createSynnelClient } from '@synnel/client-v2'
import { WebSocketClientTransport } from '@synnel/client-v2'

let messages = []
let client

onMount(async () => {
  const transport = new WebSocketClientTransport({
    url: 'ws://localhost:3000',
  })

  client = createSynnelClient({ transport })
  await client.connect()

  await client.subscribe('chat', {
    onMessage: (msg) => {
      messages = [...messages, msg.data]
    },
  })
})

onDestroy(async () => {
  await client.destroy()
})

async function sendMessage() {
  await client.publish('chat', { text: 'Hello!' })
}
</script>
```

## Advanced Usage

### Custom Logger

```typescript
const client = createSynnelClient({
  transport,
  logger: (level, message, ...args) => {
    // Custom logging implementation
    myLogger.log(level, message, ...args)
  },
})
```

### Manual Reconnection Control

```typescript
// Disable auto-reconnect
client.setAutoReconnect(false)

// Manually reconnect when needed
await client.connect()
```

### Multiple Subscriptions

```typescript
await client.subscribe('chat', {
  onMessage: (msg) => console.log('Chat:', msg.data),
})

await client.subscribe('notifications', {
  onMessage: (msg) => console.log('Notification:', msg.data),
})

const channels = client.getSubscribedChannels()
// ['chat', 'notifications']
```

## License

MIT
