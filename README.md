# Live-Tunnel 🚇

Live-Tunnel is a lightweight, framework-agnostic bridge for real-time frontend and backend synchronization. It provides an isomorphic WebSocket interface that works seamlessly across the server and browser with zero-config bi-directional syncing.

## 🌟 The Vision

Live-Tunnel aims to provide the real-time synchronization experience of platforms like **Convex** or **Supabase**, but without being tied to a specific database or cloud provider. It works with any backend, any frontend, and any data source using a **Shared Tunnel Interface** that infers types automatically.

## 🏗️ Workspace Structure

- `packages/core`: The isomorphic transport layer (Server/Client).
- `packages/react`: React hooks for seamless state synchronization.
- `example/`: A full-stack demonstration using the shared tunnel.

## 📖 Documentation

For detailed architecture and future plans, see [docs/PLANNING.md](docs/PLANNING.md).

## 🚀 Quick Start

1. **Install Dependencies:**

   ```bash
   bun install
   ```

2. **Run Example:**
   Open two terminals:

   ```bash
   # Terminal 1: Backend
   bun example/server/index.ts

   # Terminal 2: Frontend
   cd example && bun run dev
   ```

## 🛠️ Unified Interface Example

```typescript
// Shared tunnel definition
export const chat = new TunnelChannel({ tunnel, name: 'chat' })

// Backend
chat.receive((data) => console.log('Syncing to DB:', data))

// Frontend
const { data, send } = useTunnel(chat)
```
