# Server V2 Implementation Plan & TODO

> **Important**: Legacy files remain untouched. All new implementations are created in new directories.
> Legacy files: `base.ts`, `channel.ts`, `client-registry.ts`, `middleware.ts`, `server.ts`

---

## Progress Overview

```
Phase 1: Foundation      [████████████] 100% (4/4 tasks) ✅
Phase 2: Channel System  [████████████] 100% (5/5 tasks) ✅
Phase 3: Client & MW     [████████████] 100% (4/4 tasks) ✅
Phase 4: Server          [████████████] 100% (4/4 tasks) ✅
Phase 5: Testing         [████████████]  90% (9/10 tasks)
Phase 6: Finalize        [░░░░░░░░░░] 0%  (0/2 tasks)
```

**Total Progress**: 26/29 tasks (90%)

---

## Phase 1: Foundation (Tasks 1-4)

> No dependencies - can be done in parallel

### Task 1: Create config module ✅

- [x] 1.1: Create `src/config/index.ts` - Barrel exports
- [x] 1.2: Create `src/config/constants.ts`
  - `BROADCAST_CHANNEL = '__broadcast__'`
  - WebSocket close codes: `CLOSE_NORMAL = 1000`, `CLOSE_REJECTED = 4001`
  - Error codes: `REJECTED`, `MISSING_CHANNEL`, `RATE_LIMITED`
- [x] 1.3: Create `src/config/defaults.ts`
  - `DEFAULT_PORT = 3000`
  - `DEFAULT_HOST = '0.0.0.0'`
  - `DEFAULT_PATH = '/synnel'`
  - `DEFAULT_PING_INTERVAL = 30000`
  - `DEFAULT_PING_TIMEOUT = 5000`
  - `DEFAULT_MAX_PAYLOAD = 1048576` (1MB)

**Status**: `[x] COMPLETED`

---

### Task 2: Create errors module ✅

- [x] 2.1: Create `src/errors/index.ts` - Barrel exports
- [x] 2.2: Create `src/errors/errors.ts` - Base `SynnelError` class
  - Base class with `code`, `context`, `toJSON()`, `toString()`
  - Common error types: ConfigError, TransportError, ChannelError, ClientError, MessageError, ValidationError, StateError
- [x] 2.3: Create `src/errors/middleware-error.ts` - `MiddlewareRejectionError`
  - Implements `IMiddlewareRejectionError`
  - Properties: `reason: string`, `action: string`, `name = 'MiddlewareRejectionError'`
  - Also added `MiddlewareExecutionError` for unexpected middleware failures

**Status**: `[x] COMPLETED`

---

### Task 3: Create emitter module ✅

- [x] 3.1: Create `src/emitter/index.ts` - Barrel exports
- [x] 3.2: Create `src/emitter/event-emitter.ts`
  - Implements `IEventEmitter<E>` with full type safety
  - Methods: `on()`, `once()`, `off()`, `emit()`
  - Storage: `Map<keyof E, Set<E[keyof E]>>`
  - Returns unsubscribe function from `on()`
  - Additional utilities: `removeAllListeners()`, `listenerCount()`, `eventNames()`, `hasListeners()`, `rawListeners()`
  - Error handling: Handler errors don't break emission (logged to console)

**Status**: `[x] COMPLETED`

---

### Task 4: Create transport base class ✅

- [x] 4.1: Create `src/transport/index.ts` - Barrel exports
- [x] 4.2: Create `src/transport/base-transport.ts`
  - Abstract `BaseTransport` extends `EventEmitter`
  - Implements `IBaseTransport`
  - Protected: `connections: Map<ClientId, IClientConnection>`
  - Abstract method: `sendToClient()`, `on()` (event handlers)
  - Implemented utilities: `getClients()`, `getClient()`, `hasClient()`, `getClientCount()`, `getClientIds()`
  - Implemented: `disconnectClient()`, `disconnectAll()`, `clearConnections()`

**Status**: `[x] COMPLETED`

---

## Phase 2: Channel System (Tasks 5-9)

### Task 5: Create WebSocket transport implementation ✅

- [x] 5.1: Create `src/transport/websocket-transport.ts`
  - `WebSocketServerTransport` extends `BaseTransport` implements `IServerTransport`
  - Constructor takes `IServerTransportConfig`
  - Uses `ws` library
  - Ping/pong health checks with configurable interval and timeout
  - Message parsing with JSON error handling
  - Emits: `connection`, `disconnection`, `message`, `error` via internal EventEmitter
  - Auto-generates client IDs (`client-0`, `client-1`, etc.)
  - Handles: WebSocket lifecycle, message parsing, health monitoring

**Status**: `[x] COMPLETED`

---

### Task 6: Create channel base class ✅

- [x] 6.1: Create `src/channel/index.ts` - Barrel exports
- [x] 6.2: Create `src/channel/base-channel.ts`
  - Abstract `BaseChannel<T>` implements `IChannel<T>` and `IMessageHistory<T>`
  - Protected: `name`, `subscribers`, `handlers` (message/subscribe/unsubscribe), `options`, `messageHistory`
  - Implements: `publish()` as abstract method (subclasses implement sending logic)
  - Implements: `getState()`, `hasSubscriber()`, `getSubscribers()`, `isEmpty()`, `isFull()`, `isReserved()`
  - Implements: `getHistory()`, `clearHistory()` from `IMessageHistory<T>`
  - Implements: `subscriberCount` getter, `addToHistory()` protected method
  - Implements: `clear()` utility method
  - Abstract: `onMessage()`, `receive()`, `onSubscribe()`, `onUnsubscribe()`
  - Protected: `handleMessage()`, `handleSubscribe()`, `handleUnsubscribe()` trigger methods with error handling
  - Comprehensive JSDoc documentation with examples

**Status**: `[x] COMPLETED`

---

### Task 7: Create broadcast transport ✅

- [x] 7.1: Create `src/channel/broadcast-transport.ts`
  - `BroadcastTransport<T>` implements `IBroadcastTransport<T>`
  - `name: '__broadcast__'` (readonly) via `BROADCAST_CHANNEL` constant
  - `publish(data, options?)` - sends to ALL clients with filtering support
  - Uses `clients` Map (not subscribers) - reference to transport connections
  - No subscription required (server-to-all communication)
  - Implements `subscriberCount` getter (returns total connected clients)
  - Protected methods: `sendToAll()`, `sendToAllExcept()`, `sendToSpecific()`
  - Error handling for failed sends (logged to console)
  - Comprehensive JSDoc documentation with examples
  - Supports `IPublishOptions` (`to`, `exclude`) for fine-grained control

**Status**: `[x] COMPLETED`

---

### Task 8: Create multicast transport ✅

- [x] 8.1: Create `src/channel/multicast-transport.ts`
  - `MulticastTransport<T>` extends `BaseChannel<T>` implements `IChannelTransport<T>` (alias for `IMulticastTransport<T>`)
  - `subscribe()` / `unsubscribe()` methods with duplicate check and full channel check
  - `publish()` only to subscribers with `IPublishOptions` filtering support
  - `onMessage()`, `receive()` handler registration with unsubscribe support
  - `onSubscribe()`, `onUnsubscribe()` lifecycle handler registration
  - `handleSubscribe()`, `handleUnsubscribe()`, `handleMessage()` trigger methods (with `override` modifier)
  - Message history support (inherited from BaseChannel)
  - `publishTo()` convenience method for direct client communication
  - Protected send methods: `sendToAllSubscribers()`, `sendToAllSubscribersExcept()`, `sendToSpecificSubscribers()`
  - Comprehensive JSDoc documentation with examples

**Status**: `[x] COMPLETED`

---

### Task 9: Create channel barrel ✅

- [x] 9.1: Updated `src/channel/index.ts` (barrel file)
  - Re-exports: `BaseChannel`, `BroadcastTransport`, `MulticastTransport`
  - Re-exports: `BROADCAST_CHANNEL` constant from config
  - Re-exports all channel-related types from `types/base.js` and `types/channel.js`
  - Convenience re-exports for clean imports

**Status**: `[x] COMPLETED`

---

## Phase 3: Client & Middleware (Tasks 10-13)

### Task 10: Create client registry ✅

- [x] 10.1: Create `src/registry/index.ts` - Barrel exports
- [x] 10.2: Create `src/registry/client-registry.ts`
  - `ClientRegistry` implements `IClientRegistry`
  - Storage: `Map<ClientId, IClientData>`, `Map<ChannelName, Set<ClientId>>`
  - Protected `createServerClient()` method for efficient client wrapper creation
  - All CRUD operations for clients and subscriptions (register, unregister, get, getAll, getCount)
  - All subscription operations (subscribe, unsubscribe, getSubscribers, getSubscriberCount, getChannels, getTotalSubscriptionCount, isSubscribed)
  - Uses proper types from `types/client.ts`, `types/base.ts`, `types/transport.ts`
  - Uses `ClientId`, `ChannelName`, `Message` from `@synnel/types`
  - Comprehensive JSDoc documentation with examples

**Status**: `[x] COMPLETED`

---

### Task 11: Create client factory ✅

- [x] 11.1: Create `src/registry/client-factory.ts`
  - `ServerClientFactory` implements `IServerClientFactory`
  - Creates `IServerClient` wrappers from `IClientData` and `IClientConnection`
  - Optional caching with `Map<ClientId, IServerClient>` for O(1) lookups
  - Protected `createServerClientWrapper()` method for extensibility
  - Cache management: `clearCache()`, `removeFromCache()`, `getCacheSize()`
  - Default factory instance: `defaultClientFactory` with caching enabled
  - Uses proper types from `types/client.ts`, `types/base.ts`, `@synnel/types`
  - `hasSubscription()` checks `clientData.subscriptions` directly (no registry dependency)
  - Comprehensive JSDoc documentation with examples

**Status**: `[x] COMPLETED`

---

### Task 12: Create middleware manager ✅

- [x] 12.1: Create `src/middleware/index.ts` - Barrel exports
- [x] 12.2: Create `src/middleware/middleware-manager.ts`
  - `MiddlewareManager` implements `IMiddlewareManager` and `IMiddlewareContextFactory`
  - Methods: `use()`, `remove()`, `clear()`, `getCount()`, `hasMiddleware()`
  - Execute methods: `executeConnection()`, `executeMessage()`, `executeSubscribe()`, `executeUnsubscribe()`
  - Context creation: `createConnectionContext()`, `createMessageContext()`, `createSubscribeContext()`, `createUnsubscribeContext()`
  - `MiddlewareContext` class with `reject()` method that throws `MiddlewareRejectionError`
  - Throws `MiddlewareRejectionError` on `reject()` and `MiddlewareExecutionError` on unexpected errors
  - Uses proper types from `types/middleware.ts`, `types/client.ts`, `errors/middleware.ts`
  - Comprehensive JSDoc documentation with examples

**Status**: `[x] COMPLETED`

---

### Task 13: Create middleware factories ✅

- [x] 13.1: Create `src/middleware/factories.ts`
  - `createAuthMiddleware()` - with token verification, attaches user data to client
  - `createLoggingMiddleware()` - configurable logging with custom format function
  - `createRateLimitMiddleware()` - per-client rate limiting with automatic cleanup
  - `createChannelWhitelistMiddleware()` - channel access control (static or dynamic)
  - Helper functions: `clearRateLimitStore()`, `getRateLimitState()`
  - All middleware support action filtering via `actions` option
  - Uses proper types from `types/middleware.ts`, `types/client.ts`, `@synnel/types`, `config/constants.ts`
  - Comprehensive JSDoc documentation with examples

**Status**: `[x] COMPLETED`

---

## Phase 4: Server (Tasks 14-17)

### Task 14: Create handlers module ✅

- [x] 14.1: Create `src/handlers/index.ts` - Barrel exports
- [x] 14.2: Create `src/handlers/connection-handler.ts`
  - `ConnectionHandler` - processes new connections
  - Executes connection middleware
  - Registers client in registry
  - Emits connection event
- [x] 14.3: Create `src/handlers/message-handler.ts`
  - `MessageHandler` - processes data messages
  - Executes message middleware
  - Routes to appropriate channel
  - Emits message event
- [x] 14.4: Create `src/handlers/signal-handler.ts`
  - `SignalHandler` - processes signals (SUBSCRIBE, UNSUBSCRIBE, PING)
  - Executes subscribe/unsubscribe middleware
  - Manages channel subscriptions
  - Handles PING/PONG
- Uses proper types from types/, config from config/, and utilities from packages/lib

**Status**: `[x] COMPLETED`

---

### Task 15: Create server class ✅

- [x] 15.1: Create `src/server/index.ts` - Barrel exports
- [x] 15.2: Create `src/server/synnel-server.ts`
  - `SynnelServer` implements `ISynnelServer`
  - Constructor takes `IServerConfig`
  - Dependencies: `IServerTransport`, `IClientRegistry`, `IMiddlewareManager`, `IEventEmitter`, handlers
  - Lifecycle: `start()`, `stop()`
  - Channels: `createBroadcast()`, `createMulticast()`, `hasChannel()`, `getChannels()`
  - Events: `on()`, `onMessage()`, `authorize()`
  - Stats: `getStats()`
  - Middleware: `use()`
  - Uses proper types from types/, config from config/, handlers and channels

**Status**: `[x] COMPLETED`

---

### Task 16: Create server factory ✅

- [x] 16.1: Create `src/server/factory.ts`
  - `createSynnelServer(config?: IServerConfig): ISynnelServer`
  - Factory function for convenient server creation with automatic HTTP/WebSocket server setup

**Status**: `[x] COMPLETED`

---

### Task 17: Update main exports ✅

- [x] 17.1: Update `src/index.ts`
  - Export all from new modules (server, middleware, transport, channels, config, registry, handlers, errors, types)
  - Clean exports with proper categorization and documentation

**Status**: `[x] COMPLETED`

---

## Phase 5: Testing (Tasks 18-27)

### Task 18: Config tests ✅

- [x] 18.1: Create `__tests__/config.test.ts`
  - Test constants values
  - Test defaults match types
  - Test constant exports

**Status**: `[x] COMPLETED`

---

### Task 19: Errors tests ✅

- [x] 19.1: Create `__tests__/errors.test.ts`
  - Test `SynnelError` creation
  - Test `MiddlewareRejectionError` properties
  - Test instanceof checks
  - Test error message format

**Status**: `[x] COMPLETED`

---

### Task 20: Emitter tests ✅

- [x] 20.1: Create `__tests__/emitter.test.ts`
  - Test `on()` registers and returns unsubscribe
  - Test `once()` auto-removes
  - Test `off()` removes handler
  - Test `emit()` calls all handlers
  - Test type safety
  - Test multiple handlers per event
  - Test handler errors don't break emission

**Status**: `[x] COMPLETED`

---

### Task 21: Transport tests ✅

- [x] 21.1: Create `__tests__/websocket-transport.test.ts`
  - Test `WebSocketServerTransport` connection handling
  - Test `sendToClient()` sends to correct client
  - Test client storage in connections Map
  - Test ping/pong functionality
  - Test event emission

**Status**: `[x] COMPLETED`

---

### Task 22: Channel tests ✅

- [x] 22.1: Create `__tests__/channel.test.ts`
  - Test `BaseChannel` interface compliance
  - Test `BroadcastTransport` to all clients
  - Test `MulticastTransport` subscription flow
  - Test `publish()` with options (to, exclude)
  - Test handler registration (`onMessage`, `onSubscribe`, `onUnsubscribe`)
  - Test `getState()` returns correct info
  - Test message history
  - Test `maxSubscribers` limit

**Status**: `[x] COMPLETED`

---

### Task 23: Registry tests ✅

- [x] 23.1: Create `__tests__/client-registry.test.ts`
  - Test `register()` / `unregister()` lifecycle
  - Test `subscribe()` / `unsubscribe()` channel management
  - Test `get()`, `getAll()`, `getCount()` queries
  - Test `getSubscribers()`, `getSubscriberCount()` channel queries
  - Test `getChannels()`, `getTotalSubscriptionCount()`
  - Test `isSubscribed()` checks
  - Test `clear()` cleanup
  - Test client wrapper efficiency

**Status**: `[x] COMPLETED`

---

### Task 24: Middleware tests ✅

- [x] 24.1: Create `__tests__/middleware.test.ts`
  - Test `use()`, `remove()`, `clear()` management
  - Test execute methods for all action types
  - Test `MiddlewareRejectionError` on reject
  - Test execution order
  - Test stop on rejection
  - Test factory functions create valid middleware
  - Test auth middleware attaches user data
  - Test rate limiting

**Status**: `[x] COMPLETED`

---

### Task 25: Handlers tests ✅

- [x] 25.1: Create `__tests__/connection-handler.test.ts`
  - Test `ConnectionHandler` processes connections
- [x] 25.2: Create `__tests__/message-handler.test.ts`
  - Test `MessageHandler` routes messages
- [x] 25.3: Create `__tests__/signal-handler.test.ts`
  - Test `SignalHandler` handles signals
  - Test middleware execution in handlers
  - Test error handling

**Status**: `[x] COMPLETED`

---

### Task 26: Server tests ✅

- [x] 26.1: Create `__tests__/synnel-server.test.ts`
  - Test `start()` / `stop()` lifecycle
  - Test `createBroadcast()` / `createMulticast()`
  - Test `hasChannel()` / `getChannels()`
  - Test `on()` event registration
  - Test `getStats()` accuracy
  - Test `use()`, `authorize()`, `onMessage()`
  - Test `ISynnelServer` interface compliance

**Status**: `[x] COMPLETED`

---

### Task 27: Integration tests ✅

- [x] 27.1: Create `__tests__/integration/server.test.ts`
  - Test full flow: start → connect → message → disconnect → stop
  - Test channel: subscribe → publish → receive → unsubscribe
  - Test middleware chain execution
  - Test broadcast to all clients
  - Test multicast to subscribers only
  - Test error handling
  - Test multiple clients, multiple channels

**Status**: `[x] COMPLETED`

---

## Phase 6: Finalize (Tasks 28-29)

### Task 28: Update TypeScript config

- [ ] 28.1: Update `tsconfig.json` path mappings:

```json
{
  "paths": {
    "@synnel/server/config": ["./src/config"],
    "@synnel/server/errors": ["./src/errors"],
    "@synnel/server/emitter": ["./src/emitter"],
    "@synnel/server/transport": ["./src/transport"],
    "@synnel/server/channel": ["./src/channel"],
    "@synnel/server/handlers": ["./src/handlers"],
    "@synnel/server/registry": ["./src/registry"],
    "@synnel/server/middleware": ["./src/middleware"],
    "@synnel/server/server": ["./src/server"]
  }
}
```

**Status**: `[ ] NOT STARTED`

---

### Task 29: Documentation and cleanup

- [ ] 29.1: Update README.md with new API structure
- [ ] 29.2: Add JSDoc comments to all public APIs
- [ ] 29.3: Update examples in docs
- [ ] 29.4: Run TypeScript compiler - verify no errors
- [ ] 29.5: Run all tests - ensure coverage
- [ ] 29.6: Update package.json exports if needed
- [ ] 29.7: Document migration path from V1 to V2

**Status**: `[ ] NOT STARTED`

---

## Change Log

| Date       | Task    | Status               | Notes                                                                                                                                            |
| ---------- | ------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-24 | Task 1  | ✅ Completed         | Created config module with constants, defaults, and barrel exports                                                                               |
| 2026-02-24 | Task 2  | ✅ Completed         | Created errors module with SynnelError base class, MiddlewareRejectionError, and common error types                                              |
| 2026-02-24 | Task 3  | ✅ Completed         | Created emitter module with type-safe EventEmitter class                                                                                         |
| 2026-02-24 | Task 4  | ✅ Completed         | Created transport base class with BaseTransport abstract class                                                                                   |
| 2026-02-24 | Task 5  | ✅ Completed         | Created WebSocketServerTransport with ws library integration                                                                                     |
| 2026-02-24 | Task 6  | ✅ Completed         | Created BaseChannel abstract class with state management, subscriber tracking, message history, and handler infrastructure                       |
| 2026-02-24 | Task 7  | ✅ Completed         | Created BroadcastTransport for server-to-all communication with publish filtering support                                                        |
| 2026-02-24 | Task 8  | ✅ Completed         | Created MulticastTransport extending BaseChannel for topic-based pub/sub messaging                                                               |
| 2026-02-24 | Task 9  | ✅ Completed         | Updated channel barrel file (index.ts) with all exports and convenience re-exports                                                               |
| 2026-02-24 | Task 10 | ✅ Completed         | Created ClientRegistry implementing IClientRegistry with proper types from types/ directory                                                      |
| 2026-02-24 | Task 11 | ✅ Completed         | Created ServerClientFactory with optional caching for efficient IServerClient wrapper creation                                                   |
| 2026-02-24 | Task 12 | ✅ Completed         | Created MiddlewareManager implementing IMiddlewareManager with context factory and execution methods                                             |
| 2026-02-24 | Task 13 | ✅ Completed         | Created middleware factories: auth, logging, rate limit, and channel whitelist                                                                   |
| 2026-02-24 | Task 14 | ✅ Completed         | Created handlers module: ConnectionHandler, MessageHandler, SignalHandler with proper types and lib utilities                                    |
| 2026-02-24 | Task 15 | ✅ Completed         | Created SynnelServer class implementing ISynnelServer with full lifecycle, channel management, event handling, and stats                         |
| 2026-02-24 | Task 16 | ✅ Completed         | Created server factory (createSynnelServer) for convenient server creation with automatic HTTP/WebSocket server setup                            |
| 2026-02-24 | Task 17 | ✅ Completed         | Updated main index.ts with clean exports for all V2 modules (server, middleware, transport, channels, config, registry, handlers, errors, types) |
| -          | -       | Initial plan created | 29 tasks across 6 phases                                                                                                                         |

---

## Notes

### Key Improvements in V2

1. **No God Object** - Server delegates to handlers
2. **Efficient Client Wrappers** - No closure per `get()` call
3. **Type Safety** - All interfaces from `types/` directory
4. **Constants Centralized** - No magic numbers
5. **Better Testing** - Mockable dependencies
6. **Proper Auth** - Attaches user data in auth middleware

### Module Dependencies

```
config ✅ (none)
└── constants, defaults

errors (none)
└── SynnelError, MiddlewareRejectionError

emitter (none)
└── EventEmitter

transport (emitter)
└── BaseTransport

channel (base types, transport)
└── BaseChannel, BroadcastTransport, MulticastTransport

registry (transport, types)
└── ClientRegistry, ServerClientFactory

middleware (errors, types)
└── MiddlewareManager, factories

handlers (registry, middleware, emitter, channel, transport)
└── ConnectionHandler, MessageHandler, SignalHandler

server (all above)
└── SynnelServer, createSynnelServer
```
