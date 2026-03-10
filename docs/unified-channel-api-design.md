# Unified Channel API Design

**Date:** 2025-03-10
**Status:** Approved
**Author:** Syncar Team

## Overview

Merge `BroadcastChannel` and `MulticastChannel` into a single `Channel` class with configurable options. This simplifies the API surface while maintaining all functionality through a clean options-based interface.

## Motivation

- **API Simplicity**: One `createChannel()` method instead of `createBroadcast()`/`createMulticast()`
- **Code Reuse**: Both channels share 95% of implementation
- **Flexibility**: Options-based approach enables future channel modes
- **Developer Experience**: Aligns with "3 lines of code" promise

## Current Design (To Be Removed)

```typescript
// Two separate channel types
const broadcast = server.createBroadcast<string>() // all clients, receive-only
const chat = server.createMulticast('chat') // subscribers only, bidirectional
```

## New Design

### Channel Options

```typescript
interface ChannelOptions {
    /**
     * Who receives messages
     * - 'broadcast': All connected clients (no subscription concept)
     * - 'subscribers': Only subscribed clients
     * @default 'subscribers'
     */
    scope?: 'broadcast' | 'subscribers'

    /**
     * Message direction
     * - 'bidirectional': Server and clients can send
     * - 'send-only': Only server can send
     * - 'receive-only': Only clients can send
     * @default 'bidirectional'
     */
    flow?: 'bidirectional' | 'send-only' | 'receive-only'
}
```

### Behavior Matrix

| Scope         | Flow                   | Description                          | Use Case             |
| ------------- | ---------------------- | ------------------------------------ | -------------------- |
| `broadcast`   | `send-only` (enforced) | Server→all clients, no subscriptions | System announcements |
| `subscribers` | `bidirectional`        | Server↔subscribers, full API         | Chat rooms (default) |
| `subscribers` | `send-only`            | Server→subscribers only              | Live dashboards      |
| `subscribers` | `receive-only`         | Clients→server only                  | Data ingestion       |

### New Public API

```typescript
class Channel<T> {
    readonly name: string
    readonly scope: 'broadcast' | 'subscribers'
    readonly flow: 'bidirectional' | 'send-only' | 'receive-only'

    // Universal methods
    publish(data: T, options?: PublishOptions): void
    use(middleware: Middleware): void

    // Conditional: scope === 'subscribers' only
    subscribe?(clientId: string): boolean
    unsubscribe?(clientId: string): boolean
    hasSubscriber?(clientId: string): boolean
    getSubscribers?(): Set<string>

    // Conditional: flow !== 'send-only' only
    onMessage?(handler: MessageHandler<T>): () => void
}

class SyncarServer {
    // Unified channel creation
    createChannel<T>(name: string, options?: ChannelOptions): Channel<T>

    // Convenience for one-off broadcasts
    broadcast<T>(data: T): void
}
```

### Usage Examples

```typescript
// DEFAULT: subscribers + bidirectional (chat room)
const chat = syncar.createChannel('chat')
chat.onMessage((data, client) => {
    console.log(`${client.id}: ${data.text}`)
    chat.publish(data, { exclude: [client.id] })
})

// BROADCAST: all clients, send-only (announcements)
const alerts = syncar.createChannel('alerts', { scope: 'broadcast' })
alerts.publish({ type: 'warning', message: 'Server maintenance' })
// alerts.subscribe() - ❌ Method not available

// MULTICAST + SEND-ONLY: server→subscribers (live dashboard)
const updates = syncar.createChannel('updates', { flow: 'send-only' })
updates.publish({ cpu: 45, memory: 67 })
// updates.onMessage() - ❌ Error in send-only mode

// ONE-OFF BROADCAST: quick announcements
syncar.broadcast('Emergency maintenance in 5 minutes')
```

## Implementation Plan

### Phase 1: Create Unified Channel Class

1. Create `Channel<T>` class extending `BaseChannel<T>`
2. Implement conditional methods based on `scope` and `flow`
3. Add runtime validation for invalid combinations

### Phase 2: Update SyncarServer

1. Replace `createBroadcast()` and `createMulticast()` with `createChannel()`
2. Add `broadcast()` convenience method
3. Update type exports

### Phase 3: Migration & Deprecation

1. Mark old APIs as `@deprecated`
2. Update all internal usage
3. Update examples and documentation

### Phase 4: Remove Old Code (Breaking Release)

1. Remove `BroadcastChannel` and `MulticastChannel` classes
2. Remove deprecated methods
3. Clean up unused exports

## Validation Rules

```typescript
// At channel creation time:
if (options.scope === 'broadcast' && options.flow !== 'send-only') {
    throw new Error('Broadcast channels only support send-only mode')
}

// At method call time:
if (this.scope === 'broadcast') {
    // Hide/remove subscription methods
    // onMessage is not available
}

if (this.flow === 'send-only') {
    // onMessage throws error or is not available
}
```

## Backward Compatibility

- **v1.x**: Old APIs available but deprecated
- **v2.0**: Old APIs removed (breaking change)
- Migration guide provided in documentation

## Type Safety Considerations

```typescript
// Option 1: Discriminated unions for full type safety
type BroadcastChannel<T> = Channel<T> & { scope: 'broadcast'; flow: 'send-only' }
type SubscriberChannel<T> = Channel<T> & { scope: 'subscribers' }

// Option 2: Conditional types (complex but precise)
type ChannelMethods<T, S, F> = ...

// Option 3: Runtime checks with good error messages (simplest)
```

## Open Questions

1. Should `broadcast()` method create/use an internal named channel?
2. How to handle type narrowing for conditional methods?
3. Naming: `scope`/`flow` vs alternatives settled

## Decision Record

- **Scope naming**: Chose `'broadcast' | 'subscribers'` over `'all' | 'subscribers'` for semantic clarity
- **Implied behaviors**: `scope: 'broadcast'` automatically enforces `flow: 'send-only'`
- **Default behavior**: No options = `scope: 'subscribers'` + `flow: 'bidirectional'` (most common case)
