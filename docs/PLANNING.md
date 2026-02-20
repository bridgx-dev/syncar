# Live-Tunnel: The Isomorphic Sync Bridge

Live-Tunnel is a lightweight, database-agnostic synchronization layer designed to bridge the gap between frontend state and backend logic. It provides a "tunnel" through which data flows bi-directionally with minimal configuration and full type safety.

## 🚀 The Vision

Unlike platforms like Convex or Supabase that are tightly coupled to a managed database, **Live-Tunnel** is built on a "Transportation-First" philosophy. It doesn't care where your data lives (Postgres, Redis, In-Memory, or a JSON file); it only cares about making sure the frontend and backend stay in sync in real-time.

### Key Pillars:

- **Framework Agnostic:** Works with any backend (Express, Bun, Fastify) and any frontend (React, Vue, Svelte, or Vanilla JS).
- **Isomorphic Core:** A single package that detects its environment and switches between a WebSocket Server (`ws`) and a Browser WebSocket.
- **Shared Interface Pattern:** Define your communication channels once in a shared file, and let TypeScript infer the types on both ends.
- **Minimal Configuration:** No complex setup. If you have a port, you have a tunnel.

---

## 🏗️ Architecture

The system is composed of two primary primitives:

### 1. `Tunnel` (Transport Layer)

The `Tunnel` is the physical pipe.

- **Server Mode:** Spin up a WebSocket server or attach to an existing HTTP server.
- **Client Mode:** Connect to the server URL.
- **Auto-Relay:** The server-side tunnel automatically relays messages from one client to all other connected clients (Broadcast), enabling instant peer-to-peer-like sync through a central hub.

### 2. `TunnelChannel` (Logical Layer)

Channels allow for multiplexing multiple sync streams over a single WebSocket connection.

- You specify a `name` for the channel (e.g., `"chat"`, `"presence"`, `"document-123"`).
- Only components or services listening to that specific channel receive its updates.

---

## 🛠️ The "Shared Interface" Developer Experience

The core innovation is how you use Live-Tunnel in a workspace:

### Step 1: Define the Shared Tunnel

```typescript
// tunnel.ts
import { Tunnel, TunnelChannel } from '@tunnel/core';

export const tunnel = new Tunnel({ port: 3000 });

export interface AppState {
    count: number;
    lastUpdatedBy: string;
}

export const syncChannel = new TunnelChannel<AppState>({
    tunnel,
    name: 'app-state',
});
```

### Step 2: Consume on Backend

```typescript
import { syncChannel } from './tunnel';

syncChannel.receive((data) => {
    console.log('Update received:', data.count);
    // Persist to your choice of DB here
});
```

### Step 3: Consume on Frontend

```tsx
import { syncChannel } from './tunnel';
import { useTunnel } from '@tunnel/react';

function Counter() {
    const { data, send } = useTunnel(syncChannel);

    return (
        <button onClick={() => send({ count: (data?.count || 0) + 1 })}>
            Count: {data?.count}
        </button>
    );
}
```

---

## 🔄 Bi-Directional Sync Flow

1. **Client Action:** A user clicks a button, calling `send()`.
2. **Tunneling:** The client-side tunnel sends a JSON packet: `{ channel: "app-state", data: { ... } }`.
3. **Server Relay:**
    - The server receives the message.
    - It triggers any local `receive` listeners (perfect for DB persistence).
    - It **broadcasts** the message to every other connected client.
4. **Reactive Update:** All other clients receive the message, updating their React state via the `useTunnel` hook.

---

## 📈 Roadmap

- [x] Isomorphic `@tunnel/core` implementation.
- [x] Basic React Hook integration.
- [ ] Presence API (who is currently connected to the tunnel).
- [ ] Persistence Adapters (easy hooks for Redis/Postgres).
- [ ] Reliable Message Delivery (ack/retry mechanisms).
- [ ] Binary Protocol support for performance.
