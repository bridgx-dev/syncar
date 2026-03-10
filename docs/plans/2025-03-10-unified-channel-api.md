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

```typescript
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
```

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

```typescript
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
import {
    createDataMessage,
    assertValidChannelName
} from './utils'
import { ClientRegistry } from './registry'
import { BaseChannel, type IPublishOptions, type IMessageHandler } from './channel'

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
                `Got scope '${scope}' and flow '${flow}'.`
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
                `onMessage is not available in send-only mode.`
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
                `Broadcast channels send to all clients automatically.`
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
                `unsubscribe is not available for broadcast channels.`
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
                `hasSubscriber is not available for broadcast channels.`
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
                `getSubscribers is not available for broadcast channels.`
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
                    this.registry.logger?.error(
                        `[${this.name}] Error in message handler:`,
                        error as Error,
                    )
                }
            }
        } else {
            // Auto-relay mode: forward to all subscribers except sender
            // Only for subscriber scope with bidirectional flow
            if (this.scope === 'subscribers') {
                this.publish(data, { exclude: [client.id] })
            }
        }
    }
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/channel-new.ts
git commit -m "feat(channel): create unified Channel class with scope and flow options"
```

---

### Task 3: Export Channel Types from Existing channel.ts

**Files:**
- Modify: `src/channel.ts` (after line 112)

**Step 1: Export the base types used by the new Channel class**

Add these exports right after the `IMessageHandler` type definition (around line 112):

```typescript
/**
 * Export base types for use in new Channel class
 */
export type { IPublishOptions, IMessageHandler }
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/channel.ts
git commit -m "feat(channel): export IPublishOptions and IMessageHandler types"
```

---

## Phase 3: Update SyncarServer

### Task 4: Add createChannel Method to SyncarServer

**Files:**
- Modify: `src/server.ts` (after line 392, after `createBroadcast` method)

**Step 1: Add createChannel method and broadcast convenience method**

Add after the `createBroadcast` method:

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

**Step 2: Add the Channel import at the top of the file**

Add to the imports section (around line 45):

```typescript
import { Channel } from './channel-new'
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): add createChannel() and broadcast() methods"
```

---

### Task 5: Deprecate Old Methods

**Files:**
- Modify: `src/server.ts` (createBroadcast and createMulticast methods)

**Step 1: Add @deprecated tags to old methods**

Update the `createBroadcast` method JSDoc (around line 386):

```typescript
    /**
     * @deprecated Use `createChannel(name, { scope: 'broadcast' })` instead.
     * This method will be removed in v2.0.
     *
     * Get or create the broadcast channel
     *
     * @remarks
     * Returns the singleton broadcast channel that sends messages to ALL
     * connected clients. No subscription is required - all clients receive
     * broadcast messages automatically.
     *
     * @template T - Type of data to be broadcast (default: unknown)
     * @returns The broadcast channel instance
     *
     * @throws {StateError} If the server hasn't been started yet
     *
     * @example
     * ```ts
     * // OLD (deprecated)
     * const broadcast = server.createBroadcast<string>()
     *
     * // NEW (recommended)
     * const broadcast = server.createChannel('alerts', { scope: 'broadcast' })
     * ```
     */
    createBroadcast<T = unknown>(): BroadcastChannel<T> {
```

Update the `createMulticast` method JSDoc (around line 437):

```typescript
    /**
     * @deprecated Use `createChannel(name)` instead.
     * This method will be removed in v2.0.
     *
     * Create or retrieve a multicast channel
     *
     * @remarks
     * Creates a named channel that delivers messages only to subscribed clients.
     * Clients must explicitly subscribe to receive messages. If a channel with
     * the given name already exists, it will be returned instead of creating a new one.
     *
     * @template T - Type of data to be published on this channel (default: unknown)
     * @param name - Unique channel name (must not start with `__` which is reserved)
     * @returns The multicast channel instance
     *
     * @throws {StateError} If the server hasn't been started yet
     * @throws {ValidationError} If the channel name is invalid (starts with `__`)
     *
     * @example
     * ```ts
     * // OLD (deprecated)
     * const chat = server.createMulticast('chat')
     *
     * // NEW (recommended)
     * const chat = server.createChannel('chat')
     * ```
     */
    createMulticast<T = unknown>(name: ChannelName): MulticastChannel<T> {
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/server.ts
git commit -m "refactor(server): deprecate createBroadcast() and createMulticast() methods"
```

---

## Phase 4: Update Exports

### Task 6: Update Public Exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Add new exports and deprecate old ones**

Update the exports section (around line 100):

```typescript
/**
 * Syncar Server class and factory
 *
 * @example
 * ```ts
 * import { createSyncarServer, SyncarServer } from '@syncar/server'
 *
 * const server = createSyncarServer({ port: 3000 })
 * await server.start()
 *
 * // New unified API
 * const chat = server.createChannel('chat')
 * const alerts = server.createChannel('alerts', { scope: 'broadcast' })
 * ```
 */
export { SyncarServer, createSyncarServer } from './server'
export { SyncarServer as Syncar } from './server'

// New unified channel API
export { Channel } from './channel-new'

// Old channel types (deprecated)
/** @deprecated Use `Channel` instead. Will be removed in v2.0. */
export { BroadcastChannel, MulticastChannel } from './channel'

export {
  createAuthMiddleware,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createChannelWhitelistMiddleware,
} from './middleware'
export { ContextManager, createContext } from './context'

export {
  SyncarError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from './errors'
export { WebSocketServerTransport } from './websocket'

// Old exports (deprecated)
/** @deprecated Will be removed in v2.0. Use `Channel` instead. */
export { BroadcastChannel, MulticastChannel } from './channel'

export { BROADCAST_CHANNEL, CLOSE_CODES, ERROR_CODES } from './config'

export type {
  IClientConnection,
} from './types'

export type {
  IServerOptions,
  IServerStats,
} from './server'

export type {
  IChannelState,
  IPublishOptions,
  IMessageHandler,
} from './channel'

export type {
  MessageId,
  ClientId,
  SubscriberId,
  ChannelName,
  Timestamp,
  Message,
  DataMessage,
  SignalMessage,
  ErrorMessage,
  AckMessage,
  MessageType,
  SignalType,
  ErrorCode,
  Context,
  Middleware,
  ChannelOptions,
  ChannelScope,
  ChannelFlow,
} from './types'
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(exports): add Channel export, deprecate BroadcastChannel and MulticastChannel"
```

---

## Phase 5: Write Tests

### Task 7: Write Channel Class Tests

**Files:**
- Create: `__tests__/channel-new.test.ts`

**Step 1: Write failing test for Channel with default options**

Create test file:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Channel } from '../src/channel-new'
import { ClientRegistry } from '../src/registry'
import { createMockClient } from './setup'

describe('Channel', () => {
    let registry: ClientRegistry

    beforeEach(() => {
        registry = new ClientRegistry()
    })

    describe('default options', () => {
        it('should create a subscriber-scoped, bidirectional channel by default', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            expect(channel.name).toBe('chat')
            expect(channel.scope).toBe('subscribers')
            expect(channel.flow).toBe('bidirectional')
        })

        it('should allow subscription', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client = createMockClient('client-1')
            registry.add(client)

            expect(channel.subscribe('client-1')).toBe(true)
            expect(channel.hasSubscriber('client-1')).toBe(true)
        })

        it('should allow message handlers', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const handler = vi.fn()
            channel.onMessage(handler)

            expect(handler).not.toHaveBeenCalled()
        })
    })

    describe('scope: broadcast', () => {
        it('should create a broadcast-scoped channel', () => {
            const channel = new Channel({
                name: 'alerts',
                registry,
                options: { scope: 'broadcast' },
            })

            expect(channel.name).toBe('__broadcast__')
            expect(channel.scope).toBe('broadcast')
            expect(channel.flow).toBe('send-only')
        })

        it('should throw when subscribing to a broadcast channel', () => {
            const channel = new Channel({
                name: 'alerts',
                registry,
                options: { scope: 'broadcast' },
            })

            expect(() => channel.subscribe('client-1')).toThrow(
                /subscribe is not available for broadcast channels/
            )
        })

        it('should throw when checking subscribers on a broadcast channel', () => {
            const channel = new Channel({
                name: 'alerts',
                registry,
                options: { scope: 'broadcast' },
            })

            expect(() => channel.hasSubscriber('client-1')).toThrow(
                /hasSubscriber is not available for broadcast channels/
            )
        })

        it('should target all connected clients for publishing', () => {
            const channel = new Channel({
                name: 'alerts',
                registry,
                options: { scope: 'broadcast' },
            })

            const client1 = createMockClient('client-1')
            const client2 = createMockClient('client-2')
            registry.add(client1)
            registry.add(client2)

            // Both clients should be counted
            expect(channel.subscriberCount).toBe(2)
        })

        it('should not allow onMessage for broadcast scope', () => {
            const channel = new Channel({
                name: 'alerts',
                registry,
                options: { scope: 'broadcast' },
            })

            expect(() => channel.onMessage(vi.fn())).not.toThrow()
            // But it shouldn't do anything since flow is send-only
        })
    })

    describe('flow: send-only', () => {
        it('should create a send-only channel', () => {
            const channel = new Channel({
                name: 'updates',
                registry,
                options: { flow: 'send-only' },
            })

            expect(channel.scope).toBe('subscribers')
            expect(channel.flow).toBe('send-only')
        })

        it('should throw when adding message handler to send-only channel', () => {
            const channel = new Channel({
                name: 'updates',
                registry,
                options: { flow: 'send-only' },
            })

            expect(() => channel.onMessage(vi.fn())).toThrow(
                /onMessage is not available in send-only mode/
            )
        })

        it('should not dispatch messages from clients in send-only mode', async () => {
            const channel = new Channel({
                name: 'updates',
                registry,
                options: { flow: 'send-only' },
            })

            const client = createMockClient('client-1')
            registry.add(client)
            channel.subscribe(client.id)

            const publishSpy = vi.spyOn(channel, 'publish')

            // Dispatch should not publish in send-only mode
            await channel.dispatch({ text: 'hello' }, client, {
                id: 'msg-1',
                type: 'data' as any,
                channel: 'updates',
                timestamp: Date.now(),
                data: { text: 'hello' },
            })

            expect(publishSpy).not.toHaveBeenCalled()
        })
    })

    describe('flow: receive-only', () => {
        it('should create a receive-only channel', () => {
            const channel = new Channel({
                name: 'ingestion',
                registry,
                options: { flow: 'receive-only' },
            })

            expect(channel.scope).toBe('subscribers')
            expect(channel.flow).toBe('receive-only')
        })

        it('should allow message handlers in receive-only mode', () => {
            const channel = new Channel({
                name: 'ingestion',
                registry,
                options: { flow: 'receive-only' },
            })

            expect(() => channel.onMessage(vi.fn())).not.toThrow()
        })
    })

    describe('validation', () => {
        it('should throw when scope is broadcast and flow is not send-only', () => {
            expect(() => new Channel({
                name: 'invalid',
                registry,
                options: { scope: 'broadcast', flow: 'bidirectional' },
            })).toThrow(/broadcast scope only supports send-only flow/)
        })

        it('should throw when scope is broadcast and flow is receive-only', () => {
            expect(() => new Channel({
                name: 'invalid',
                registry,
                options: { scope: 'broadcast', flow: 'receive-only' },
            })).toThrow(/broadcast scope only supports send-only flow/)
        })
    })

    describe('middleware', () => {
        it('should allow adding middleware', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const middleware = vi.fn()
            channel.use(middleware)

            expect(channel.getMiddlewares()).toHaveLength(1)
        })
    })

    describe('publishing', () => {
        it('should publish to subscribers in subscriber scope', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client1 = createMockClient('client-1')
            const client2 = createMockClient('client-2')
            registry.add(client1)
            registry.add(client2)

            channel.subscribe('client-1')
            channel.subscribe('client-2')

            // Only subscribers should be counted
            expect(channel.subscriberCount).toBe(2)
        })

        it('should publish to all clients in broadcast scope', () => {
            const channel = new Channel({
                name: 'alerts',
                registry,
                options: { scope: 'broadcast' },
            })

            const client1 = createMockClient('client-1')
            const client2 = createMockClient('client-2')
            registry.add(client1)
            registry.add(client2)

            // All clients should be counted
            expect(channel.subscriberCount).toBe(2)
        })
    })

    describe('message dispatch', () => {
        it('should auto-relay when no handlers are registered (bidirectional)', async () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client1 = createMockClient('client-1')
            const client2 = createMockClient('client-2')
            registry.add(client1)
            registry.add(client2)

            channel.subscribe('client-1')
            channel.subscribe('client-2')

            const publishSpy = vi.spyOn(channel, 'publish')

            await channel.dispatch(
                { text: 'hello' },
                client1,
                {
                    id: 'msg-1',
                    type: 'data' as any,
                    channel: 'chat',
                    timestamp: Date.now(),
                    data: { text: 'hello' },
                }
            )

            // Should publish to all except sender
            expect(publishSpy).toHaveBeenCalledWith({ text: 'hello' }, { exclude: ['client-1'] })
        })

        it('should call handlers when registered (bidirectional)', async () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client = createMockClient('client-1')
            registry.add(client)
            channel.subscribe(client.id)

            const handler = vi.fn()
            channel.onMessage(handler)

            await channel.dispatch(
                { text: 'hello' },
                client,
                {
                    id: 'msg-1',
                    type: 'data' as any,
                    channel: 'chat',
                    timestamp: Date.now(),
                    data: { text: 'hello' },
                }
            )

            expect(handler).toHaveBeenCalledWith(
                { text: 'hello' },
                client,
                expect.objectContaining({ id: 'msg-1' })
            )
        })
    })
})
```

**Step 2: Run test**

Run: `bun test __tests__/channel-new.test.ts`
Expected: FAIL (tests run but implementation needs adjustments)

**Step 3: Fix any issues and run again**

Run: `bun test __tests__/channel-new.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add __tests__/channel-new.test.ts
git commit -m "test: add comprehensive tests for unified Channel class"
```

---

### Task 8: Write SyncarServer Integration Tests

**Files:**
- Modify: `__tests__/server.test.ts` (add new tests)

**Step 1: Add tests for createChannel and broadcast methods**

Add to existing server test file:

```typescript
    describe('createChannel', () => {
        it('should create a channel with default options', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel = server.createChannel('chat')

            expect(channel.name).toBe('chat')
            expect(channel.scope).toBe('subscribers')
            expect(channel.flow).toBe('bidirectional')
        })

        it('should create a broadcast channel', async () => {
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

        it('should return existing channel if already created', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const channel1 = server.createChannel('chat')
            const channel2 = server.createChannel('chat')

            expect(channel1).toBe(channel2)
        })

        it('should throw if server not started', () => {
            const server = createSyncarServer({ port: 0 })

            expect(() => server.createChannel('chat')).toThrow('Server must be started')
        })
    })

    describe('broadcast', () => {
        it('should broadcast to all clients', async () => {
            const server = createSyncarServer({ port: 0 })
            await server.start()

            const mockClients = [
                createMockClient('client-1'),
                createMockClient('client-2'),
            ]

            for (const client of mockClients) {
                server.getRegistry().add(client)
            }

            // Should not throw
            expect(() => server.broadcast('Hello everyone')).not.toThrow()
        })

        it('should throw if server not started', () => {
            const server = createSyncarServer({ port: 0 })

            expect(() => server.broadcast('test')).toThrow('Server must be started')
        })
    })
```

**Step 2: Run test**

Run: `bun test __tests__/server.test.ts`
Expected: PASS (with new tests passing)

**Step 3: Commit**

```bash
git add __tests__/server.test.ts
git commit -m "test: add tests for createChannel() and broadcast() methods"
```

---

## Phase 6: Update Documentation

### Task 9: Update README with New API

**Files:**
- Modify: `../../README.md`

**Step 1: Update README examples**

Replace the old API examples with new ones. Here are the key sections to update:

```markdown
## 🚀 Quick Start

### 1. Server Setup (with Express)

```typescript
import express from 'express'
import { createServer } from 'http'
import { createSyncarServer } from '@syncar/server'

const app = express()
const httpServer = createServer(app)

// Initialize Syncar with Express server
const syncar = createSyncarServer({ server: httpServer })

// Start the server first
await syncar.start()

// Create channels
const chat = syncar.createChannel('chat')  // Subscribers + bidirectional (default)
const alerts = syncar.createChannel('alerts', { scope: 'broadcast' })  // All clients

// Handle incoming messages
chat.onMessage((data, client) => {
  console.log(`Received from ${client.id}:`, data)
  // Relay to all other clients
  chat.publish(data, { exclude: [client.id] })
})

httpServer.listen(3000)
```

### 2. Standalone Server (no Express)

```typescript
import { createSyncarServer } from '@syncar/server'

// Creates HTTP server on port 3000
const syncar = createSyncarServer({ port: 3000 })

await syncar.start()

const chat = syncar.createChannel('chat')

// One-off broadcast
syncar.broadcast({ message: 'Welcome!' })
```
```

**Step 2: Run build to verify**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add ../../README.md
git commit -m "docs: update README with unified channel API examples"
```

---

### Task 10: Create Migration Guide

**Files:**
- Create: `docs/MIGRATION.md`

**Step 1: Write migration guide**

Create migration guide:

```markdown
# Migration Guide: v1.x → v2.0

## Unified Channel API

In v2.0, `BroadcastChannel` and `MulticastChannel` have been merged into a single `Channel` class with configurable options.

### Changes

| Old API (v1.x) | New API (v2.0) |
|----------------|----------------|
| `server.createBroadcast<T>()` | `server.createChannel('name', { scope: 'broadcast' })` |
| `server.createMulticast<T>('name')` | `server.createChannel('name')` |

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
  flow: 'bidirectional'
})
```

#### Broadcast Channel

```typescript
// OLD (v1.x)
const broadcast = server.createBroadcast<string>()

// NEW (v2.0)
const broadcast = server.createChannel<string>('announcements', {
  scope: 'broadcast'
})

// Or use the convenience method for one-off broadcasts
syncar.broadcast('Hello everyone')
```

### Channel Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `scope` | `'broadcast'` \| `'subscribers'` | `'subscribers'` | Who receives messages |
| `flow` | `'bidirectional'` \| `'send-only'` \| `'receive-only'` | `'bidirectional'` | Message direction |

### Breaking Changes

1. **`BroadcastChannel` and `MulticastChannel` classes removed** - Use `Channel` instead
2. **`createBroadcast()` and `createMulticast()` methods removed** - Use `createChannel()` instead
3. **Channel name is ignored for broadcast scope** - The name is still required for API consistency but unused

### New Features

- **`flow: 'send-only'`** - Create channels where only the server can send
- **`flow: 'receive-only'`** - Create channels where only clients can send
- **`broadcast()` method** - Quick one-off broadcasts without channel reference
```

**Step 2: Commit**

```bash
git add docs/MIGRATION.md
git commit -m "docs: add migration guide for v2.0 unified channel API"
```

---

## Phase 7: Cleanup and Finalization

### Task 11: Rename channel-new.ts to unified implementation

**Files:**
- Rename: `src/channel-new.ts` → (merge into `src/channel.ts`)
- Modify: All imports

**Step 1: Merge the new Channel implementation into existing channel.ts**

At the end of `src/channel.ts`, add the unified Channel class export and re-export from channel-new:

Add at the very end of the file:

```typescript
// Re-export unified Channel class
export { Channel } from './channel-new'
```

**Step 2: Update all imports**

No changes needed - this keeps backward compatibility during deprecation period.

**Step 3: Run build**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/channel.ts
git commit -m "refactor(channel): re-export unified Channel class"
```

---

### Task 12: Update Package.json Version for v2.0

**Files:**
- Modify: `package.json`

**Step 1: Update version**

Change version from `1.0.0-alpha.1` to `2.0.0-alpha.1`:

```json
{
  "name": "@syncar/server",
  "version": "2.0.0-alpha.1",
  ...
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 2.0.0-alpha.1 for unified channel API"
```

---

## Summary Checklist

- [ ] Phase 1: Type definitions added
- [ ] Phase 2: Unified Channel class created
- [ ] Phase 3: SyncarServer updated with new methods
- [ ] Phase 4: Exports updated
- [ ] Phase 5: Tests written and passing
- [ ] Phase 6: Documentation updated
- [ ] Phase 7: Cleanup complete

## Testing Commands

```bash
# Type check
bun run build

# Run all tests
bun test

# Run specific test file
bun test __tests__/channel-new.test.ts

# Run tests with coverage
bun test:coverage
```

## Git Commands

```bash
# After all tasks complete
git add .
git commit -m "feat: complete unified channel API implementation (v2.0-alpha)"
```
