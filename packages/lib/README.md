# @syncar/lib

**INTERNAL PACKAGE - NOT FOR PUBLICATION**

Common utility functions for Syncarr real-time synchronization packages.

> **WARNING:** This package is marked as `private: true` and should NOT be published to npm. It is intended for internal use within the Syncarr monorepo only.

## Installation

```bash
# This package is automatically available via workspace protocol
bun add @syncar/lib
```

## Usage

```typescript
import {
    generateMessageId,
    isValidChannelName,
    createDefaultLogger,
    calculateBackoff,
} from '@syncar/lib'

// Generate a unique message ID
const messageId = generateMessageId()

// Validate channel name
if (isValidChannelName('chat')) {
    // ...
}

// Create a logger
const logger = createDefaultLogger('MyApp')
logger('info', 'Application started')

// Calculate reconnection delay
const delay = calculateBackoff(3, {
    initialDelay: 1000,
    maxDelay: 30000,
})
```

## Available Utilities

### ID Generation (`./id.ts`)

- `generateMessageId()` - Generate unique message IDs
- `generateClientId()` - Generate unique client IDs
- `generateSubscriberId()` - Generate unique subscriber IDs
- `randomString(length)` - Generate random alphanumeric strings
- `isValidMessageId()` - Validate message ID format
- `isValidClientId()` - Validate client ID format
- `isValidSubscriberId()` - Validate subscriber ID format

### Validation (`./validation.ts`)

- `isValidChannelName()` - Validate channel name format
- `isReservedChannelName()` - Check if channel name is reserved
- `isNonReservedChannelName()` - Validate non-reserved channel name
- `assertValidChannelName()` - Assert channel name is valid (throws if not)

### Message Utilities (`./message.ts`)

- `isDataMessage()` - Type guard for DataMessage
- `isSignalMessage()` - Type guard for SignalMessage
- `isErrorMessage()` - Type guard for ErrorMessage
- `isAckMessage()` - Type guard for AckMessage
- `createDataMessage()` - Factory for creating data messages
- `createSignalMessage()` - Factory for creating signal messages
- `createErrorMessage()` - Factory for creating error messages
- `createAckMessage()` - Factory for creating acknowledgment messages

### Reconnection (`./reconnection.ts`)

- `calculateBackoff()` - Calculate exponential backoff delay
- `calculateBackoffWithJitter()` - Calculate backoff with deterministic jitter
- `shouldReconnect()` - Check if reconnection should be attempted
- `createInitialReconnectionState()` - Create initial reconnection state
- `advanceReconnectionState()` - Update reconnection state for next attempt
- `resetReconnectionState()` - Reset reconnection state after success

### Logger (`./logger.ts`)

- `createDefaultLogger()` - Create console-based logger
- `createNoOpLogger()` - Create silent logger
- `createPrefixedLogger()` - Create logger with prefix
- `createFilteredLogger()` - Create logger that filters by level
- `createThresholdLogger()` - Create logger with minimum level threshold
- `createDebugLogger()` - Create logger with debug toggle
- `createLogTimestamp()` - Generate ISO timestamp for logs

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck

# Run tests
bun run test

# Watch mode
bun run dev
```

## License

MIT
