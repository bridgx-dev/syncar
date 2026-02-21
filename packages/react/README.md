# @synnel/react ⚛️

The React integration for Synnel. Provides a powerful set of hooks and components to connect your React application to a Synnel server with minimal effort.

## Features

- **Connection Management**: Automatically handles WebSocket connection lifecycle.
- **Strict Mode Safe**: Does not double-subscribe or drop connections during React 18's double-mount.
- **Typed Hooks**: Full TypeScript support for your data models.
- **Status Tracking**: Built-in tracking for connection status (`connecting`, `open`, `closed`).

## Installation

```bash
npm install @synnel/react
```

## Usage

### 1. Wrap with SynnelProvider

```tsx
import { SynnelProvider } from '@synnel/react'

export function Layout({ children }) {
  return <SynnelProvider url="ws://localhost:3000">{children}</SynnelProvider>
}
```

### 2. Use the useChannel Hook

The `useChannel` hook is the primary way to interact with a Synnel channel.

```tsx
import { useChannel } from '@synnel/react'

export function Chat() {
  const { data, send, status, loading, error } = useChannel('chat', {
    onMessage: (msg) => console.log('New message!', msg),
    onError: (err) => console.error('Channel error', err),
  })

  if (loading) return <div>Joining channel...</div>

  return (
    <div>
      <p>Status: {status}</p>
      <button onClick={() => send({ text: 'Hello!' })}>Send</button>
      <pre>{JSON.stringify(data)}</pre>
    </div>
  )
}
```

### 3. Direct Client Access

If you need low-level access to the client:

```tsx
import { useSynnel } from '@synnel/react'

function CustomSocketLogic() {
  const { client, status } = useSynnel()

  // Use client.subscribe(), client.send(), etc.
}
```

## License

MIT
