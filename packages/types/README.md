# @syncar/types

**INTERNAL PACKAGE - NOT FOR PUBLICATION**

Shared TypeScript type definitions for Syncarr real-time synchronization packages.

> **WARNING:** This package is marked as `private: true` and should NOT be published to npm. It is intended for internal use within the Syncarr monorepo only.

## Installation

```bash
# This package is automatically available via workspace protocol
bun add @syncar/types
```

## Usage

```typescript
import type {
    Message,
    DataMessage,
    ChannelName,
    ConnectionStatus,
    TransportConfig,
} from '@syncar/types'

// Use the types in your code
const channel: ChannelName = 'chat'
const status: ConnectionStatus = 'connected'
```

## Available Types

### Common Types

- `MessageId`, `ClientId`
- `ChannelName`, `Timestamp`
- `DataPayload<T>`

### Connection Types

- `ConnectionStatus`
- `TransportConfig`
- `MessageQueueOptions`

### Channel Types

- `ChannelState<T>`
- `ChannelOptions`
- `MessageBusOptions`
- `SubscriptionState`

### Message Types

- `Message<T>`
- `DataMessage<T>`
- `SignalMessage`
- `ErrorMessage`
- `AckMessage`
- `MessageType` (enum)
- `SignalType` (enum)
- `ErrorCode` (enum)

### Client Types

- `ClientStatus`
- `Transport`
- `ClientConfig`
- `ChannelSubscription<T>`
- `ClientStats`

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck

# Watch mode
bun run dev
```

## License

MIT
