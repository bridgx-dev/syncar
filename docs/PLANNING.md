# Live-Tunnel: The Isomorphic Sync Bridge

Live-Tunnel is a lightweight, database-agnostic synchronization layer designed to bridge the gap between frontend state and backend logic. It provides a "tunnel" through which data flows bi-directionally with minimal configuration and full type safety.

## 🚀 The Vision

Unlike platforms like Convex or Supabase that are tightly coupled to a managed database, **Live-Tunnel** is built on a "Transportation-First" philosophy. It doesn't care where your data lives (Postgres, Redis, In-Memory, or a JSON file); it only cares about making sure the frontend and backend stay in sync in real-time.

### Key Pillars:

- **Framework Agnostic:** Works with any backend (Express, Bun, Fastify) and any frontend (React, Vue, Svelte, or Vanilla JS).
- **Core Abstractions:** A single package providing `Tunnel` (Server) and `Client` (Browser) optimized for their respective environments.
- **Shared Interface Pattern:** Define your communication channels once in a shared file, and let TypeScript infer the types on both ends.
- **Minimal Configuration:** No complex setup. If you have a port, you have a tunnel.

---

## 🏗️ Architecture

The system is composed of two primary primitives:

### 1. `Tunnel` & `Client` (Transport Layer)

The physical pipe through which data flows.

- **`Tunnel` (Server):** Manages connections, subscriptions (Signal Plane), and data relay using a pluggable `Store`.
- **`Client` (Browser):** Handles the WebSocket connection in the browser with automatic reconnects and status tracking.
- **Pluggable Storage:** Support for `MemoryStore` (single instance) and `RedisStore` (distributed scaling).

### 2. `Channel` (Logical Layer)

Named multiplexing on top of a single connection.

- **Scoped Sync:** Only subscribers to a specific channel (e.g., `"chat"`) receive updates for it.
- **Auto-Binding:** Create channels directly via `tunnel.createChannel('name')` to skip manual binding.
- **Late Binding:** Channels can be defined in shared files and bound later via `channel.bind(tunnel)`.

---

## 🛠️ The "Shared Interface" Developer Experience

The core innovation is how you use Live-Tunnel in a workspace:

### Step 1: Define Shared Channels

```typescript
// shared/tunnel.ts
import { Channel } from '@tunnel/core'

export interface AppState {
  count: number
  lastUpdatedBy: string
}

// Named channel with a specific type
export const syncChannel = new Channel<AppState>({
  name: 'app-state',
})
```

### Step 2: Consume on Backend

```typescript
import { Tunnel } from '@tunnel/core'
import { syncChannel } from './shared/tunnel'

const tunnel = new Tunnel({ port: 3000, storage: 'redis' })

// Option A: Bind a shared channel instance
syncChannel.bind(tunnel)

// Option B: Create channel directly (auto-bound)
// const syncChannel = tunnel.createChannel<AppState>('app-state');

syncChannel.receive((data) => {
  console.log('Update received:', data.count)
  // Persist to DB
})
```

### Step 3: Consume on Frontend

```tsx
import { syncChannel } from './shared/tunnel'
import { TunnelProvider, useChannel } from '@tunnel/react'

function App() {
  return (
    <TunnelProvider url="ws://localhost:3000">
      <Counter />
    </TunnelProvider>
  )
}

function Counter() {
  const { data, send } = useChannel(syncChannel)

  return (
    <button onClick={() => send({ count: (data?.count || 0) + 1 })}>
      Count: {data?.count}
    </button>
  )
}
```

---

## 🔄 Bi-Directional Sync Flow

1. **Client Action:** A user clicks a button, calling `send()`.
2. **Tunneling:** The client-side tunnel sends a JSON packet: `{ channel: "app-state", data: { ... } }`.
3. **Server Relay:**
   - The server receives the message.
   - It triggers any local `receive` listeners (perfect for DB persistence).
   - It **relays** the message to all clients subscribed to that channel (via the `Store`).
4. **Reactive Update:** All other clients receive the message, updating their React state via the `useChannel` hook.

---

## 📈 Roadmap

- [x] Server (`Tunnel`) and Client (`Client`) implementations.
- [x] Scalable `Store` architecture (Memory & Redis).
- [x] Basic React Hook integration (`useChannel`).
- [x] Auto-reconnect with Exponential Backoff in `Client`.
- [ ] Presence API (tracking current active subscribers per channel).
- [ ] Reliable Message Delivery (ack/retry mechanisms with message IDs).
- [ ] Binary Protocol (BSON or Protobuf) support for high-throughput sync.
- [ ] Persistence Adapters (automatic sync to Postgres/Redis JSON).
