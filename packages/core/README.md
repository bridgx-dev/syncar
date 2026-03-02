# @synnel/core

Platform-agnostic core for Synnel real-time synchronization.

## Overview

This package provides the foundational abstractions for real-time pub/sub communication without any transport layer dependencies. It's designed to be:

- **Platform-agnostic**: Works in browser, Node.js, or any JavaScript runtime
- **Transport-agnostic**: No WebSocket or network dependencies
- **Type-safe**: Full TypeScript support with strict mode
- **Minimal**: Small footprint with zero dependencies

## Installation

```bash
npm install @synnel/core
# or
pnpm add @synnel/core
# or
yarn add @synnel/core
```

## Quick Start

```typescript
import { MessageBus, createDataMessage } from '@synnel/core'

// Create a message bus
const bus = new MessageBus()

// Create a channel
const channel = bus.createChannel('chat')

// Subscribe clients to the channel
bus.subscribe('chat', 'client-1')
bus.subscribe('chat', 'client-2')

// Publish a message
const message = createDataMessage('chat', { text: 'Hello, world!' })
bus.publish('chat', message, 'client-1') // Exclude sender
```

## Core Concepts

### MessageBus

The central hub for managing channels and routing messages.

```typescript
import { MessageBus } from '@synnel/core'

const bus = new MessageBus({
  autoCreateChannels: true,
  autoDeleteEmptyChannels: true,
  emptyChannelGracePeriod: 5000,
})
```

### Channel

Represents a named topic with subscribers.

```typescript
import { Channel } from '@synnel/core'

const channel = new Channel('chat', {
  maxSubscribers: 100,
  historySize: 50,
})

// Subscribe
channel.subscribe('client-1')

// Check subscribers
channel.hasSubscriber('client-1') // true
channel.getSubscriberCount() // 1

// Unsubscribe
channel.unsubscribe('client-1')
```

### Messages

All messages follow the protocol defined in this package.

```typescript
import {
  createDataMessage,
  createSignalMessage,
  createErrorMessage,
} from '@synnel/core'

// Data message
const dataMsg = createDataMessage('chat', { text: 'Hello' })

// Signal message (control)
const signalMsg = createSignalMessage('chat', SignalType.SUBSCRIBE)

// Error message
const errorMsg = createErrorMessage(
  'Channel not found',
  ErrorCode.CHANNEL_NOT_FOUND,
)
```

## API Reference

### Classes

#### `MessageBus`

| Method                                      | Description                |
| ------------------------------------------- | -------------------------- |
| `createChannel(name, options?)`             | Create a new channel       |
| `getChannel(name)`                          | Get existing channel       |
| `getOrCreateChannel(name, options?)`        | Get or create channel      |
| `subscribe(channel, subscriber)`            | Subscribe to channel       |
| `unsubscribe(channel, subscriber)`          | Unsubscribe from channel   |
| `publish(channel, message, excludeSender?)` | Publish message            |
| `broadcast(message, excludeSender?)`        | Broadcast to all channels  |
| `onMessage(handler)`                        | Add global message handler |
| `deleteChannel(name)`                       | Delete a channel           |
| `getStats()`                                | Get statistics             |

#### `Channel`

| Method                      | Description            |
| --------------------------- | ---------------------- |
| `subscribe(subscriber)`     | Add subscriber         |
| `unsubscribe(subscriber)`   | Remove subscriber      |
| `hasSubscriber(subscriber)` | Check if subscribed    |
| `getSubscribers()`          | Get all subscribers    |
| `getSubscriberCount()`      | Get subscriber count   |
| `isEmpty()`                 | Check if empty         |
| `isFull()`                  | Check if at capacity   |
| `getHistory()`              | Get message history    |
| `clear()`                   | Remove all subscribers |

### Type Guards

```typescript
import { isDataMessage, isSignalMessage, isErrorMessage } from '@synnel/core'

if (isDataMessage(message)) {
  // message.data is typed
  console.log(message.data)
}
```

## License

MIT
