# Server Development Structure

## Final Project Structure

```
packages/server/
├── src/
│   ├── types/                      # Type definitions (COMPLETED)
│   │   ├── base.ts              # Foundational interfaces
│   │   ├── transport.ts         # Transport layer types
│   │   ├── client.ts            # Client management types
│   │   ├── channel.ts           # Channel types
│   │   ├── middleware.ts        # Middleware types
│   │   ├── server.ts            # Server configuration types
│   │   ├── events.ts            # Event system types
│   │   ├── utilities.ts         # Type utilities
│   │   └── index.ts             # Barrel exports
│   │
│   ├── transport/                 # Transport implementations
│   │   ├── index.ts
│   │   └── base-transport.ts    # Abstract base class
│   │
│   ├── channel/                   # Channel implementations
│   │   ├── index.ts
│   │   ├── base-channel.ts      # Abstract base class
│   │   ├── broadcast-transport.ts
│   │   └── multicast-transport.ts
│   │
│   ├── handlers/                  # Event/message handlers
│   │   ├── index.ts
│   │   ├── connection-handler.ts
│   │   ├── message-handler.ts
│   │   └── signal-handler.ts
│   │
│   ├── registry/                  # Client registry
│   │   ├── index.ts
│   │   └── client-registry.ts   # Client registry implementation
│   │
│   ├── middleware/                # Middleware system
│   │   ├── index.ts
│   │   ├── middleware-manager.ts # Middleware manager implementation
│   │   └── factories.ts          # Middleware factory functions
│   │
│   ├── server/                    # Main server implementation
│   │   ├── index.ts
│   │   └── synnel-server.ts      # SynnelServer implementation
│   │
│   ├── config/                    # Configuration and constants
│   │   ├── index.ts
│   │   ├── constants.ts          # All constants
│   │   └── defaults.ts           # Default values
│   │
│   ├── errors/                    # Error classes
│   │   ├── index.ts
│   │   ├── errors.ts             # Custom error classes
│   │   └── middleware-error.ts   # Middleware-specific errors
│   │
│   ├── emitter/                   # Event emitter
│   │   ├── index.ts
│   │   └── event-emitter.ts      # Type-safe event emitter
│   │
│   ├── base.ts                    # WebSocket transport implementation
│   ├── channel.ts                 # Channel barrel (backward compatibility)
│   ├── client-registry.ts         # Client registry (legacy)
│   ├── middleware.ts              # Middleware (legacy)
│   ├── server.ts                  # Server (legacy)
│   ├── index.ts                   # Main exports
│   │
├── __tests__/                     # Test files
│   ├── setup.ts
│   ├── unit/
│   │   ├── transport.test.ts
│   │   ├── registry.test.ts
│   │   ├── handlers.test.ts
│   │   ├── middleware.test.ts
│   │   └── server.test.ts
│   └── integration/
│       └── server.test.ts
│
├── docs/
│   └── plan/
│       ├── development-structure.md
│       └── implementation-plan.md
│
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Module Responsibilities

### `/types` - Type Definitions
- **Purpose**: Single source of truth for all interfaces
- **Extends**: No dependencies on other server modules
- **Export**: All interfaces used by implementations

### `/transport` - Transport Implementations
- **Purpose**: WebSocket transport layer
- **Extends**: `IBaseTransport`, `IServerTransport` from types
- **Classes**: `BaseTransport` (abstract), `WebSocketServerTransport` (in base.ts)

### `/channel` - Channel Implementations
- **Purpose**: Channel-based messaging (broadcast, multicast)
- **Extends**: `IChannel<T>`, `IChannelTransport<T>`, `IBroadcastTransport<T>`
- **Classes**: `BaseChannel<T>`, `BroadcastTransport<T>`, `MulticastTransport<T>`

### `/handlers` - Event/Message Handlers
- **Purpose**: Process connections, messages, and signals
- **Extends**: Uses types from `/types`
- **Classes**: `ConnectionHandler`, `MessageHandler`, `SignalHandler`

### `/registry` - Client Registry
- **Purpose**: Manage connected clients and subscriptions
- **Extends**: `IClientRegistry` interface
- **Classes**: `ClientRegistry`

### `/middleware` - Middleware System
- **Purpose**: Middleware execution and factory functions
- **Extends**: `IMiddlewareManager`, middleware interfaces
- **Classes**: `MiddlewareManager`, factory functions

### `/server` - Main Server
- **Purpose**: Orchestrate all components
- **Extends**: `ISynnelServer` interface
- **Classes**: `SynnelServer`

### `/config` - Configuration & Constants
- **Purpose**: All constants and default values
- **Contains**: `BROADCAST_CHANNEL`, `ERROR_CODES`, `DEFAULT_CONFIG`

### `/errors` - Error Classes
- **Purpose**: Custom error classes
- **Contains**: `MiddlewareRejectionError`, `SynnelError`

### `/emitter` - Event Emitter
- **Purpose**: Type-safe event emission
- **Extends**: `IEventEmitter<T>` interface
- **Classes**: `EventEmitter`
