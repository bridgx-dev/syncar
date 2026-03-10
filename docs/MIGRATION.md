# Migration Guide: v1.x → v2.0

## Unified Channel API

In v2.0, `BroadcastChannel` and `MulticastChannel` have been merged into a single `Channel` class with configurable options.

### Changes

| Old API (v1.x)                      | New API (v2.0)                                         |
| ----------------------------------- | ------------------------------------------------------ |
| `server.createBroadcast<T>()`       | `server.createChannel('name', { scope: 'broadcast' })` |
| `server.createMulticast<T>('name')` | `server.createChannel('name')`                         |

### Migration Examples

#### Multicast Channel (Default)

```typescript
// OLD (v1.x)
const chat = server.createMulticast<{ text: string }>('chat')

// NEW (v2.0)
const chat = server.createChannel<{ text: string }>('chat')
// or explicitly
const chat = server.createChannel<{ text: string }>('chat', {
    scope: 'subscribers',
    flow: 'bidirectional',
})
```

#### Broadcast Channel

```typescript
// OLD (v1.x)
const broadcast = server.createBroadcast<string>()

// NEW (v2.0)
const broadcast = server.createChannel<string>('announcements', {
    scope: 'broadcast',
})

// Or use the convenience method for one-off broadcasts
syncar.broadcast('Hello everyone')
```

### Channel Options

| Option  | Values                                                 | Default           | Description           |
| ------- | ------------------------------------------------------ | ----------------- | --------------------- |
| `scope` | `'broadcast'` \| `'subscribers'`                       | `'subscribers'`   | Who receives messages |
| `flow`  | `'bidirectional'` \| `'send-only'` \| `'receive-only'` | `'bidirectional'` | Message direction     |

### Breaking Changes

1. **`BroadcastChannel` and `MulticastChannel` classes removed** - Use `Channel` instead
2. **`createBroadcast()` and `createMulticast()` methods removed** - Use `createChannel()` instead
3. **Channel name is ignored for broadcast scope** - The name is still required for API consistency but unused

### New Features

- **`flow: 'send-only'`** - Create channels where only the server can send
- **`flow: 'receive-only'`** - Create channels where only clients can send
- **`broadcast()` method** - Quick one-off broadcasts without channel reference
