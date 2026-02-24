# Server V2 Implementation Plan & TODO

> **Important**: Legacy files remain untouched. All new implementations are created in new directories.
> Legacy files: `base.ts`, `channel.ts`, `client-registry.ts`, `middleware.ts`, `server.ts`

---

## Progress Overview

```
Phase 1: Foundation      [███░░░░░░░░] 50%  (2/4 tasks)
Phase 2: Channel System  [░░░░░░░░░░] 0%  (0/5 tasks)
Phase 3: Client & MW     [░░░░░░░░░░] 0%  (0/4 tasks)
Phase 4: Server          [░░░░░░░░░░] 0%  (0/4 tasks)
Phase 5: Testing         [░░░░░░░░░░] 0%  (0/10 tasks)
Phase 6: Finalize        [░░░░░░░░░░] 0%  (0/2 tasks)
```

**Total Progress**: 2/29 tasks (7%)

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

### Task 3: Create emitter module
- [ ] 3.1: Create `src/emitter/index.ts` - Barrel exports
- [ ] 3.2: Create `src/emitter/event-emitter.ts`
  - Implements `IEventEmitter<E>`
  - Methods: `on()`, `once()`, `off()`, `emit()`
  - Storage: `Map<keyof E, Set<E[keyof E]>>`
  - Returns unsubscribe function from `on()`

**Status**: `[ ] NOT STARTED`

---

### Task 4: Create transport base class
- [ ] 4.1: Create `src/transport/index.ts` - Barrel exports
- [ ] 4.2: Create `src/transport/base-transport.ts`
  - Abstract `BaseTransport` extends `EventEmitter`
  - Implements `IBaseTransport`
  - Protected: `connections: Map<ClientId, IClientConnection>`
  - Abstract methods: `sendToClient()`, `getClients()`, `getClient()`
  - Implements `on()` for transport events

**Status**: `[ ] NOT STARTED`

---

## Phase 2: Channel System (Tasks 5-9)

### Task 5: Create WebSocket transport implementation
- [ ] 5.1: Create `src/transport/websocket-transport.ts`
  - `WebSocketServerTransport` extends `BaseTransport`
  - Constructor takes `IServerTransportConfig`
  - Uses `ws` library
  - Ping/pong health checks
  - Message parsing with error handling
  - Emits: `connection`, `disconnection`, `message`, `error`

**Status**: `[ ] NOT STARTED`

---

### Task 6: Create channel base class
- [ ] 6.1: Create `src/channel/index.ts` - Barrel exports
- [ ] 6.2: Create `src/channel/base-channel.ts`
  - Abstract `BaseChannel<T>` implements `IChannel<T>`
  - Protected: `name`, `subscribers`, `handlers`, `options`, `messageHistory`
  - Implements: `publish()` with `IPublishOptions`
  - Implements: `getState()`, `hasSubscriber()`, `getSubscribers()`, `isEmpty()`, `isFull()`, `isReserved()`
  - Implements: `getHistory()`, `clearHistory()`
  - Abstract: `onMessage()`, `receive()`, `onSubscribe()`, `onUnsubscribe()`

**Status**: `[ ] NOT STARTED`

---

### Task 7: Create broadcast transport
- [ ] 7.1: Create `src/channel/broadcast-transport.ts`
  - `BroadcastTransport<T>` implements `IBroadcastTransport<T>`
  - `name: '__broadcast__'` (readonly)
  - `publish(data, options?)` - sends to ALL clients
  - Uses `clients` Map (not subscribers)
  - No subscription required

**Status**: `[ ] NOT STARTED`

---

### Task 8: Create multicast transport
- [ ] 8.1: Create `src/channel/multicast-transport.ts`
  - `MulticastTransport<T>` implements `IMulticastTransport<T>`
  - `subscribe()` / `unsubscribe()` methods
  - `publish()` only to subscribers
  - `handleSubscribe()` / `handleUnsubscribe()` lifecycle
  - `handleMessage()` triggers message handlers
  - Message history support

**Status**: `[ ] NOT STARTED`

---

### Task 9: Create channel barrel
- [ ] 9.1: Create `src/channel/barrel.ts`
  - Re-exports: `BaseChannel`, `BroadcastTransport`, `MulticastTransport`
  - Convenience re-exports

**Status**: `[ ] NOT STARTED`

---

## Phase 3: Client & Middleware (Tasks 10-13)

### Task 10: Create client registry
- [ ] 10.1: Create `src/registry/index.ts` - Barrel exports
- [ ] 10.2: Create `src/registry/client-registry.ts`
  - `ClientRegistry` implements `IClientRegistry`
  - Storage: `Map<ClientId, IClientData>`, `Map<ChannelName, Set<ClientId>>`
  - Efficient `ServerClient` creation (no closure per call)
  - All CRUD operations for clients and subscriptions

**Status**: `[ ] NOT STARTED`

---

### Task 11: Create client factory
- [ ] 11.1: Create `src/registry/client-factory.ts`
  - `ServerClientFactory` implements `IServerClientFactory`
  - Creates `IServerClient` wrappers from `IClientData`
  - Cached or efficient wrapper creation

**Status**: `[ ] NOT STARTED`

---

### Task 12: Create middleware manager
- [ ] 12.1: Create `src/middleware/index.ts` - Barrel exports
- [ ] 12.2: Create `src/middleware/middleware-manager.ts`
  - `MiddlewareManager` implements `IMiddlewareManager`
  - Methods: `use()`, `remove()`, `clear()`
  - Execute methods: `executeConnection()`, `executeMessage()`, `executeSubscribe()`, `executeUnsubscribe()`
  - Throws `MiddlewareRejectionError` on `reject()`

**Status**: `[ ] NOT STARTED`

---

### Task 13: Create middleware factories
- [ ] 13.1: Create `src/middleware/factories.ts`
  - `createAuthMiddleware()` - with token verification, attaches user data
  - `createLoggingMiddleware()` - configurable logging
  - `createRateLimitMiddleware()` - per-client rate limiting
  - `createChannelWhitelistMiddleware()` - channel access control

**Status**: `[ ] NOT STARTED`

---

## Phase 4: Server (Tasks 14-17)

### Task 14: Create handlers module
- [ ] 14.1: Create `src/handlers/index.ts` - Barrel exports
- [ ] 14.2: Create `src/handlers/connection-handler.ts`
  - `ConnectionHandler` - processes new connections
  - Executes connection middleware
  - Registers client in registry
  - Emits connection event
- [ ] 14.3: Create `src/handlers/message-handler.ts`
  - `MessageHandler` - processes data messages
  - Executes message middleware
  - Routes to appropriate channel
  - Emits message event
- [ ] 14.4: Create `src/handlers/signal-handler.ts`
  - `SignalHandler` - processes signals (SUBSCRIBE, UNSUBSCRIBE, PING)
  - Executes subscribe/unsubscribe middleware
  - Manages channel subscriptions
  - Handles PING/PONG

**Status**: `[ ] NOT STARTED`

---

### Task 15: Create server class
- [ ] 15.1: Create `src/server/index.ts` - Barrel exports
- [ ] 15.2: Create `src/server/synnel-server.ts`
  - `SynnelServer` implements `ISynnelServer`
  - Constructor takes `IServerConfig`
  - Dependencies: `IServerTransport`, `IClientRegistry`, `IMiddlewareManager`, `IEventEmitter`, handlers
  - Lifecycle: `start()`, `stop()`
  - Channels: `createBroadcast()`, `createMulticast()`, `hasChannel()`, `getChannels()`
  - Events: `on()`, `onMessage()`, `authorize()`
  - Stats: `getStats()`
  - Middleware: `use()`

**Status**: `[ ] NOT STARTED`

---

### Task 16: Create server factory
- [ ] 16.1: Create `src/server/factory.ts`
  - `createSynnelServer(config?: IServerConfig): ISynnelServer`
  - Factory function for convenient server creation

**Status**: `[ ] NOT STARTED`

---

### Task 17: Update main exports
- [ ] 17.1: Update `src/index.ts`
  - Export all from new modules
  - Keep legacy exports separate for backward compatibility
  - Document new vs. legacy exports

**Status**: `[ ] NOT STARTED`

---

## Phase 5: Testing (Tasks 18-27)

### Task 18: Config tests
- [ ] 18.1: Create `__tests__/unit/config.test.ts`
  - Test constants values
  - Test defaults match types
  - Test constant exports

**Status**: `[ ] NOT STARTED`

---

### Task 19: Errors tests
- [ ] 19.1: Create `__tests__/unit/errors.test.ts`
  - Test `SynnelError` creation
  - Test `MiddlewareRejectionError` properties
  - Test instanceof checks
  - Test error message format

**Status**: `[ ] NOT STARTED`

---

### Task 20: Emitter tests
- [ ] 20.1: Create `__tests__/unit/emitter.test.ts`
  - Test `on()` registers and returns unsubscribe
  - Test `once()` auto-removes
  - Test `off()` removes handler
  - Test `emit()` calls all handlers
  - Test type safety
  - Test multiple handlers per event
  - Test handler errors don't break emission

**Status**: `[ ] NOT STARTED`

---

### Task 21: Transport tests
- [ ] 21.1: Create `__tests__/unit/transport.test.ts`
  - Test `BaseTransport` interface compliance
  - Test `WebSocketServerTransport` connection handling
  - Test `sendToClient()` sends to correct client
  - Test client storage in connections Map
  - Test ping/pong functionality
  - Test event emission

**Status**: `[ ] NOT STARTED`

---

### Task 22: Channel tests
- [ ] 22.1: Create `__tests__/unit/channel.test.ts`
  - Test `BaseChannel` interface compliance
  - Test `BroadcastTransport` to all clients
  - Test `MulticastTransport` subscription flow
  - Test `publish()` with options (to, exclude)
  - Test handler registration (`onMessage`, `onSubscribe`, `onUnsubscribe`)
  - Test `getState()` returns correct info
  - Test message history
  - Test `maxSubscribers` limit

**Status**: `[ ] NOT STARTED`

---

### Task 23: Registry tests
- [ ] 23.1: Create `__tests__/unit/registry.test.ts`
  - Test `register()` / `unregister()` lifecycle
  - Test `subscribe()` / `unsubscribe()` channel management
  - Test `get()`, `getAll()`, `getCount()` queries
  - Test `getSubscribers()`, `getSubscriberCount()` channel queries
  - Test `getChannels()`, `getTotalSubscriptionCount()`
  - Test `isSubscribed()` checks
  - Test `clear()` cleanup
  - Test client wrapper efficiency

**Status**: `[ ] NOT STARTED`

---

### Task 24: Middleware tests
- [ ] 24.1: Create `__tests__/unit/middleware.test.ts`
  - Test `use()`, `remove()`, `clear()` management
  - Test execute methods for all action types
  - Test `MiddlewareRejectionError` on reject
  - Test execution order
  - Test stop on rejection
  - Test factory functions create valid middleware
  - Test auth middleware attaches user data
  - Test rate limiting

**Status**: `[ ] NOT STARTED`

---

### Task 25: Handlers tests
- [ ] 25.1: Create `__tests__/unit/handlers.test.ts`
  - Test `ConnectionHandler` processes connections
  - Test `MessageHandler` routes messages
  - Test `SignalHandler` handles signals
  - Test middleware execution in handlers
  - Test error handling

**Status**: `[ ] NOT STARTED`

---

### Task 26: Server tests
- [ ] 26.1: Create `__tests__/unit/server.test.ts`
  - Test `start()` / `stop()` lifecycle
  - Test `createBroadcast()` / `createMulticast()`
  - Test `hasChannel()` / `getChannels()`
  - Test `on()` event registration
  - Test `getStats()` accuracy
  - Test `use()`, `authorize()`, `onMessage()`
  - Test `ISynnelServer` interface compliance

**Status**: `[ ] NOT STARTED`

---

### Task 27: Integration tests
- [ ] 27.1: Create `__tests__/integration/server.test.ts`
  - Test full flow: start → connect → message → disconnect → stop
  - Test channel: subscribe → publish → receive → unsubscribe
  - Test middleware chain execution
  - Test broadcast to all clients
  - Test multicast to subscribers only
  - Test error handling
  - Test multiple clients, multiple channels

**Status**: `[ ] NOT STARTED`

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

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2026-02-24 | Task 1 | ✅ Completed | Created config module with constants, defaults, and barrel exports |
| 2026-02-24 | Task 2 | ✅ Completed | Created errors module with SynnelError base class, MiddlewareRejectionError, and common error types |
| - | - | Initial plan created | 29 tasks across 6 phases |

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
