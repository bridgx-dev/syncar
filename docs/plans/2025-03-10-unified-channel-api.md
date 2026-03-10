# Unified Channel API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge `BroadcastChannel` and `MulticastChannel` into a single `Channel` class with configurable `scope` and `flow` options, simplifying the API while maintaining all functionality.

**Architecture:** Create a unified `Channel<T>` class that extends `BaseChannel<T>` with conditional methods based on `scope` ('broadcast' | 'subscribers') and `flow` ('bidirectional' | 'send-only' | 'receive-only'). Update `SyncarServer` to expose `createChannel()` and `broadcast()` methods. Maintain backward compatibility through deprecation.

**Tech Stack:** TypeScript, Node.js, ws (WebSocket library), vitest (testing)

---

## Phase 1: Add Type Definitions

### Task 1: Add Channel Options Type

**Files:**

- Modify: `src/types.ts` (after line 852)

**Step 1: Add ChannelOptions interface**

Add at the end of `src/types.ts` before the closing of the file:

````typescript
// ============================================================
// CHANNEL TYPES
// ============================================================

/**
 * Channel scope - who receives messages
 *
 * @remarks
 * - 'broadcast': All connected clients receive messages
 * - 'subscribers': Only subscribed clients receive messages
 *
 * @example
 * ```ts
 * const scope: ChannelScope = 'broadcast'  // All clients
 * const scope2: ChannelScope = 'subscribers'  // Only subscribers
 * ```
 */
export type ChannelScope = 'broadcast' | 'subscribers'

/**
 * Channel flow - message direction
 *
 * @remarks
 * - 'bidirectional': Server and clients can send messages
 * - 'send-only': Only server can send messages
 * - 'receive-only': Only clients can send messages
 *
 * @example
 * ```ts
 * const flow: ChannelFlow = 'bidirectional'  // Both directions
 * const flow2: ChannelFlow = 'send-only'  // Server only
 * const flow3: ChannelFlow = 'receive-only'  // Clients only
 * ```
 */
export type ChannelFlow = 'bidirectional' | 'send-only' | 'receive-only'

/**
 * Channel creation options
 *
 * @remarks
 * Configuration options when creating a channel with `createChannel()`.
 *
 * @property scope - Who receives messages (default: 'subscribers')
 * @property flow - Message direction (default: 'bidirectional')
 *
 * @example
 * ```ts
 * // Default: subscribers + bidirectional
 * const chat = server.createChannel('chat')
 *
 * // Broadcast to all clients, send-only
 * const alerts = server.createChannel('alerts', { scope: 'broadcast' })
 *
 * // Subscribers only, send-only
 * const updates = server.createChannel('updates', { flow: 'send-only' })
 * ```
 */
export interface ChannelOptions {
    /** Who receives: 'broadcast' (all) or 'subscribers' (only subscribed) */
    scope?: ChannelScope
    /** Message direction: 'bidirectional', 'send-only', or 'receive-only' */
    flow?: ChannelFlow
}
````

**Step 2: Run type check**

Run: `bun run build` or `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add ChannelOptions, ChannelScope, and ChannelFlow types"
```

---

## Phase 2: Create Unified Channel Class

### Task 2: Create New Channel Class File

**Files:**

- Create: `src/channel-new.ts`

**Step 1: Write the Channel class with conditional methods**

Create `src/channel-new.ts`:

````typescript
import {
    type ChannelName,
    type ClientId,
    type SubscriberId,
    type DataMessage,
    type IClientConnection,
    type IMiddleware,
    type ChannelOptions,
    type ChannelScope,
    type ChannelFlow,
} from './types'
import { createDataMessage, assertValidChannelName } from './utils'
import { ClientRegistry } from './registry'
import {
    BaseChannel,
    type IPublishOptions,
    type IMessageHandler,
} from './channel'

/**
 * Unified Channel - supports both broadcast and multicast modes
 *
 * @remarks
 * A single channel class that replaces `BroadcastChannel` and `MulticastChannel`.
 * Behavior is controlled by `scope` and `flow` options:
 *
 * - **scope: 'broadcast'**: Sends to ALL clients, no subscription concept
 * - **scope: 'subscribers'**: Sends only to subscribed clients
 *
 * - **flow: 'bidirectional'**: Server and clients can send
 * - **flow: 'send-only'**: Only server can send
 * - **flow: 'receive-only'**: Only clients can send
 *
 * @template T - Type of data published on this channel (default: unknown)
 *
 * @example
 * ### Default: subscribers + bidirectional (chat room)
 * ```ts
 * const chat = server.createChannel('chat')
 * chat.onMessage((data, client) => {
 *   console.log(`${client.id}: ${data.text}`)
 *   chat.publish(data, { exclude: [client.id] })
 * })
 * ```
 *
 * @example
 * ### Broadcast: all clients, send-only (announcements)
 * ```ts
 * const alerts = server.createChannel('alerts', { scope: 'broadcast' })
 * alerts.publish({ type: 'warning', message: 'Server maintenance' })
 * // alerts.subscribe() - ❌ Method not available for broadcast
 * ```
 *
 * @example
 * ### Subscribers + send-only (live dashboard)
 * ```ts
 * const updates = server.createChannel('updates', { flow: 'send-only' })
 * updates.publish({ cpu: 45, memory: 67 })
 * // updates.onMessage() - ❌ Error in send-only mode
 * ```
 */
export class Channel<T = unknown> extends BaseChannel<T> {
    private readonly middlewares: IMiddleware[] = []
    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()

    /** The channel scope: 'broadcast' or 'subscribers' */
    public readonly scope: ChannelScope

    /** The channel flow: 'bidirectional', 'send-only', or 'receive-only' */
    public readonly flow: ChannelFlow

    /**
     * Creates a new Channel instance
     *
     * @param config.name - The channel name
     * @param config.registry - The client registry
     * @param config.options - Channel options (scope, flow)
     * @param config.chunkSize - Broadcast chunk size
     *
     * @throws {Error} If scope is 'broadcast' and flow is not 'send-only'
     *
     * @example
     * ```ts
     * new Channel({
     *   name: 'chat',
     *   registry: registry,
     *   options: { scope: 'subscribers', flow: 'bidirectional' }
     * })
     * ```
     */
    constructor(config: {
        name: ChannelName
        registry: ClientRegistry
        options?: ChannelOptions
        chunkSize?: number
    }) {
        const { name, registry, options, chunkSize } = config

        // Apply defaults
        const scope = options?.scope ?? 'subscribers'
        const flow = options?.flow ?? 'bidirectional'

        // Validation: broadcast scope only allows send-only flow
        if (scope === 'broadcast' && flow !== 'send-only') {
            throw new Error(
                `Invalid channel configuration: broadcast scope only supports send-only flow. ` +
                    `Got scope '${scope}' and flow '${flow}'.`,
            )
        }

        // For broadcast scope, use the broadcast channel name
        const channelName = scope === 'broadcast' ? '__broadcast__' : name
        assertValidChannelName(channelName)

        super(channelName, registry, chunkSize)

        this.scope = scope
        this.flow = flow
    }

    /**
     * Get target clients based on scope
     *
     * @internal
     */
    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        if (this.scope === 'broadcast') {
            return Array.from(this.registry.connections.keys())
        }
        return Array.from(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Get the number of subscribers/clients
     *
     * @returns Number of clients that will receive messages
     *
     * @example
     * ```ts
     * console.log(`Channel reach: ${channel.subscriberCount}`)
     * ```
     */
    get subscriberCount(): number {
        if (this.scope === 'broadcast') {
            return this.registry.connections.size
        }
        return this.registry.getChannelSubscribers(this.name).size
    }

    /**
     * Check if channel has no subscribers/clients
     *
     * @returns `true` if no clients will receive messages
     *
     * @example
     * ```ts
     * if (channel.isEmpty()) {
     *   console.log('No one is listening')
     * }
     * ```
     */
    isEmpty(): boolean {
        return this.subscriberCount === 0
    }

    /**
     * Get middleware for this channel
     *
     * @internal
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Register channel-specific middleware
     *
     * @param middleware - The middleware function
     *
     * @example
     * ```ts
     * channel.use(async (context, next) => {
     *   console.log(`Action: ${context.req.action}`)
     *   await next()
     * })
     * ```
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Register a message handler (not available in send-only mode)
     *
     * @param handler - The message handler function
     * @returns Unsubscribe function
     * @throws {Error} If flow is 'send-only'
     *
     * @example
     * ```ts
     * const unsubscribe = channel.onMessage((data, client) => {
     *   console.log(`Received from ${client.id}:`, data)
     * })
     *
     * // Later
     * unsubscribe()
     * ```
     */
    onMessage(handler: IMessageHandler<T>): () => void {
        if (this.flow === 'send-only') {
            throw new Error(
                `Cannot register message handler on channel '${this.name}': ` +
                    `onMessage is not available in send-only mode.`,
            )
        }
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    /**
     * Subscribe a client (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if subscribed successfully
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * channel.subscribe('client-123')
     * ```
     */
    subscribe(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot subscribe to channel '${this.name}': ` +
                    `subscribe is not available for broadcast channels. ` +
                    `Broadcast channels send to all clients automatically.`,
            )
        }
        return this.registry.subscribe(subscriber, this.name)
    }

    /**
     * Unsubscribe a client (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if unsubscribed successfully
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * channel.unsubscribe('client-123')
     * ```
     */
    unsubscribe(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot unsubscribe from channel '${this.name}': ` +
                    `unsubscribe is not available for broadcast channels.`,
            )
        }
        return this.registry.unsubscribe(subscriber, this.name)
    }

    /**
     * Check if a client is subscribed (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if subscribed
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * if (channel.hasSubscriber('client-123')) {
     *   console.log('Client is subscribed')
     * }
     * ```
     */
    hasSubscriber(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot check subscribers on channel '${this.name}': ` +
                    `hasSubscriber is not available for broadcast channels.`,
            )
        }
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    /**
     * Get all subscribers (only available for subscriber scope)
     *
     * @returns Set of subscriber IDs
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * const subs = channel.getSubscribers()
     * console.log(`Subscribers: ${Array.from(subs).join(', ')}`)
     * ```
     */
    getSubscribers(): Set<SubscriberId> {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot get subscribers on channel '${this.name}': ` +
                    `getSubscribers is not available for broadcast channels.`,
            )
        }
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Dispatch an incoming client message
     *
     * @internal
     */
    override async dispatch(
        data: T,
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        // Send-only channels don't receive client messages
        if (this.flow === 'send-only') {
            return
        }

        if (this.messageHandlers.size > 0) {
            // Intercept mode: handlers process the message
            for (const handler of this.messageHandlers) {
                try {
                    await handler(data, client, message)
                } catch (error) {
                    client.send({
                        type: 'error',
                        id: message.id,
                        error: {
                            code: 'MESSAGE_HANDLER_ERROR',
                            message: `Error in message handler: ${(error as Error).message}`,
                        },
                    })
                }
            }
        }
    }
}
````

**Step 2: Run tests**

Run: `bun test` or `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/channel-new.ts
git commit -m "feat(channel): create unified Channel class with scope and flow options"
```

---

## Phase 3: Update SyncarServer

### Task 3: Update Server Class

**Files:**
- Modify: `src/server.ts`

**Step 1: Import the new Channel class**

At the top of `src/server.ts`, add:

```typescript
import { Channel } from './channel-new'
```

**Step 2: Update createChannel method**

Replace the existing `createChannel()` method with the unified version:

```typescript
/**
 * Create or retrieve a channel with configurable scope and flow
 *
 * @remarks
 * Unified channel creation that replaces `createBroadcast()` and `createMulticast()`.
 * Channels are configured using `scope` and `flow` options:
 *
 * - **scope: 'broadcast'** - Sends to ALL clients (no subscriptions)
 * - **scope: 'subscribers'** - Sends only to subscribed clients (default)
 *
 * - **flow: 'bidirectional'** - Server and clients can send (default)
 * - **flow: 'send-only'** - Only server can send
 * - **flow: 'receive-only'** - Only clients can send
 *
 * @template T - Type of data to be published on this channel (default: unknown)
 * @param name - Unique channel name (ignored for broadcast scope)
 * @param options - Channel configuration options
 * @returns The channel instance
 *
 * @throws {StateError} If the server hasn't been started yet
 * @throws {Error} If options are invalid (e.g., broadcast with non-send-only flow)
 *
 * @example
 * ### Default: subscribers + bidirectional (chat room)
 * ```ts
 * const chat = server.createChannel('chat')
 * chat.onMessage((data, client) => {
 *   chat.publish(data, { exclude: [client.id] })
 * })
 * ```
 *
 * @example
 * ### Broadcast: all clients, send-only
 * ```ts
 * const alerts = server.createChannel('alerts', { scope: 'broadcast' })
 * alerts.publish({ message: 'Maintenance in 5 min' })
 * ```
 *
 * @example
 * ### Subscribers + send-only (live dashboard)
 * ```ts
 * const updates = server.createChannel('updates', { flow: 'send-only' })
 * updates.publish({ cpu: 45, memory: 67 })
 * ```
 */
createChannel<T = unknown>(name: ChannelName, options?: ChannelOptions): Channel<T> {
    if (!this.status.started || !this.transport) {
        throw new StateError('Server must be started before creating channels')
    }

    // For broadcast scope, check if we already have the broadcast channel
    if (options?.scope === 'broadcast') {
        if (this.broadcastChannel) {
            return this.broadcastChannel as unknown as Channel<T>
        }
        throw new StateError('Broadcast channel not initialized')
    }

    // For subscriber scope, check if channel already exists
    const existing = this.registry.getChannel<T>(name) as Channel<T> | undefined
    if (existing) return existing

    const channel = new Channel<T>({
        name,
        registry: this.registry,
        options,
        chunkSize: this.config.broadcastChunkSize,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.registry.registerChannel(channel as any)
    return channel
}
```

**Step 3: Mark old methods as deprecated**

Add `@deprecated` tags to `createBroadcast()` and `createMulticast()`:

```typescript
/**
 * @deprecated Use `createChannel(name, { scope: 'broadcast' })` instead.
 * This method will be removed in v2.0.
 */
createBroadcast<T = unknown>(): BroadcastChannel<T> {
    // ... existing implementation
}

/**
 * @deprecated Use `createChannel(name)` instead.
 * This method will be removed in v2.0.
 */
createMulticast<T = unknown>(name: ChannelName): MulticastChannel<T> {
    // ... existing implementation
}
```

**Step 4: Add broadcast() convenience method**

Add this method for one-off broadcasts:

```typescript
/**
 * Send a one-off broadcast message to all connected clients
 *
 * @remarks
 * Convenience method for sending a single message to all clients without
 * creating a channel reference. This is useful for announcements and alerts.
 *
 * @template T - Type of data to broadcast (default: unknown)
 * @param data - The data to broadcast
 * @param options - Optional publish options for client filtering
 *
 * @throws {StateError} If the server hasn't been started yet
 *
 * @example
 * ```ts
 * server.broadcast('Server maintenance at midnight')
 *
 * server.broadcast({ type: 'warning', message: 'High load detected' })
 *
 * // Exclude specific clients
 * server.broadcast('Admin message', { exclude: ['client-123'] })
 * ```
 */
broadcast<T = unknown>(data: T, options?: IPublishOptions): void {
    if (!this.status.started || !this.broadcastChannel) {
        throw new StateError('Server must be started before broadcasting')
    }
    this.broadcastChannel.publish(data, options)
}
```

**Step 5: Run tests**

Run: `bun test` or `npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): add unified createChannel() and broadcast() methods, deprecate old APIs"
```

---

## Phase 4: Update Exports

### Task 4: Update Main Exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Export Channel and update types**

Update exports:

```typescript
// New unified channel API
export { Channel } from './channel'

// Old channel types (deprecated)
/** @deprecated Use `Channel` instead. Will be removed in v2.0. */
export { BroadcastChannel } from './channel'
/** @deprecated Use `Channel` instead. Will be removed in v2.0. */
export { MulticastChannel } from './channel'

// Export new types
export type {
    IClientConnection,
    ChannelOptions,
    ChannelScope,
    ChannelFlow,
} from './types'
```

**Step 2: Run type check**

Run: `bun run build` or `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(exports): add Channel export, deprecate BroadcastChannel and MulticastChannel"
```

---

## Phase 5: Update Examples

### Task 5: Update Example Files

**Files:**
- Modify: `examples/chat/server/index.ts`
- Modify: `examples/chat/client/src/components/Chat.tsx`

**Step 1: Update server example**

Replace `createMulticast()` with `createChannel()`:

```typescript
// Old
const chat = server.createMulticast<{ text: string; user: string }>('chat')

// New
const chat = server.createChannel<{ text: string; user: string }>('chat')
```

**Step 2: Update client example (if needed)**

Ensure client examples use the correct channel names.

**Step 3: Test examples**

Run: `cd examples/chat && bun run dev`
Expected: Chat application works correctly

**Step 4: Commit**

```bash
git add examples/
git commit -m "docs(examples): update to use unified createChannel() API"
```

---

## Phase 6: Update Documentation

### Task 6: Update README and Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/**/*.md`

**Step 1: Update README**

Replace all instances of `createBroadcast()` and `createMulticast()` with `createChannel()`.

**Step 2: Update API documentation**

Ensure all docs reflect the new unified API.

**Step 3: Add migration guide**

Add a section explaining how to migrate from old to new API:

```markdown
## Migration Guide

### From `createBroadcast()` to `createChannel()`

**Old API:**
```typescript
const broadcast = server.createBroadcast<string>()
broadcast.publish('Hello everyone')
```

**New API:**
```typescript
const alerts = server.createChannel('alerts', { scope: 'broadcast' })
alerts.publish('Hello everyone')

// Or use the convenience method
server.broadcast('Hello everyone')
```

### From `createMulticast()` to `createChannel()`

**Old API:**
```typescript
const chat = server.createMulticast('chat')
chat.onMessage((data, client) => {
    console.log(data)
})
```

**New API:**
```typescript
const chat = server.createChannel('chat')
chat.onMessage((data, client) => {
    console.log(data)
})
```
```

**Step 4: Commit**

```bash
git add README.md docs/
git commit -m "docs: update documentation for unified channel API"
```

---

## Phase 7: Testing

### Task 7: Add Tests for New API

**Files:**
- Create: `__tests__/channel-unified.test.ts`

**Step 1: Write comprehensive tests**

Test all combinations of scope and flow:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createSyncarServer } from '../src/server'

describe('Unified Channel API', () => {
    describe('createChannel()', () => {
        it('should create a subscriber channel by default', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel = server.createChannel('test')
            expect(channel.scope).toBe('subscribers')
            expect(channel.flow).toBe('bidirectional')
            expect(channel.name).toBe('test')
        })

        it('should create a broadcast channel with scope option', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel = server.createChannel('alerts', { scope: 'broadcast' })
            expect(channel.scope).toBe('broadcast')
            expect(channel.flow).toBe('send-only')
        })

        it('should create a send-only subscriber channel', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel = server.createChannel('updates', { flow: 'send-only' })
            expect(channel.scope).toBe('subscribers')
            expect(channel.flow).toBe('send-only')
        })

        it('should throw error for broadcast with non-send-only flow', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            expect(() => {
                server.createChannel('invalid', { scope: 'broadcast', flow: 'bidirectional' })
            }).toThrow()
        })

        it('should not allow subscribe() on broadcast channels', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel = server.createChannel('alerts', { scope: 'broadcast' })
            expect(() => channel.subscribe('client-1')).toThrow()
        })

        it('should not allow onMessage() on send-only channels', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel = server.createChannel('updates', { flow: 'send-only' })
            expect(() => channel.onMessage(() => {})).toThrow()
        })
    })

    describe('broadcast()', () => {
        it('should send message to all clients', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            // Test broadcast functionality
            server.broadcast('Hello everyone')
            // Verify all clients receive the message
        })
    })
})
```

**Step 2: Run tests**

Run: `bun test` or `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add __tests__/
git commit -m "test: add comprehensive tests for unified channel API"
```

---

## Phase 8: Final Polish

### Task 8: Clean Up and Verify

**Step 1: Run full test suite**

```bash
bun run test
bun run build
```

Expected: All tests pass, build succeeds

**Step 2: Update package.json version**

Bump version for release:

```bash
npm version minor  # e.g., 1.1.0
```

**Step 3: Create changelog entry**

Add to `CHANGELOG.md`:

```markdown
## [1.1.0] - 2025-03-10

### Added
- Unified `Channel` class with configurable `scope` and `flow` options
- `createChannel()` method replacing `createBroadcast()` and `createMulticast()`
- `broadcast()` convenience method for one-off broadcasts
- `ChannelOptions`, `ChannelScope`, and `ChannelFlow` types

### Changed
- Simplified channel API surface area

### Deprecated
- `createBroadcast()` - Use `createChannel(name, { scope: 'broadcast' })` instead
- `createMulticast()` - Use `createChannel(name)` instead
- `BroadcastChannel` class - Use `Channel` instead
- `MulticastChannel` class - Use `Channel` instead
```

**Step 4: Final commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore: prepare for v1.1.0 release"
```

**Step 5: Create pull request**

```bash
git push origin feat/unified-channel-api
```

---

## Success Criteria

- [x] `Channel` class created with scope and flow options
- [x] `createChannel()` method added to `SyncarServer`
- [x] `broadcast()` convenience method added
- [x] Old APIs (`createBroadcast`, `createMulticast`) marked as deprecated
- [x] All tests pass
- [x] Examples updated
- [x] Documentation updated
- [x] Migration guide provided
- [x] Type safety maintained

---

## Rollback Plan

If issues arise:

1. Revert commits: `git revert HEAD~N`
2. Keep deprecated methods functional
3. Address issues in next iteration

---

## Future Improvements

- Consider adding type narrowing for conditional methods
- Add more flow options if needed (e.g., 'server-only')
- Performance optimizations for high-volume broadcasts
