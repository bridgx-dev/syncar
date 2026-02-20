# Planning: Implementation Modularity

Currently, **Synnel** is well-structured but has some monolithic parts (like `Store.ts` containing all implementations) and tight coupling to specific WebSocket implementations in `Tunnel.ts`.

## Goals

- **Separation of Concerns**: Each `Store` implementation should be its own file/module.
- **Pluggable Architecture**: Allow third-party transport layers (beyond just `ws` or `browser websockets`) and custom store backends easily.
- **Tree Shaking & Bundle Size**: Ensure that when using only basic features (e.g., `MemoryStore`), heavy dependencies (like `redis`) are not even loaded into the server process.
- **Consistent Interface across Environments**: While `Tunnel` and `Client` differ in role, their APIs should feel like part of the same toolkit.

---

## 🏗️ Proposed Modular Structure

### 1. `Store/` Directory

Move `packages/core/src/Store.ts` into a directory:

- `packages/core/src/store/BaseStore.ts`
- `packages/core/src/store/MemoryStore.ts`
- `packages/core/src/store/RedisStore.ts`
- `packages/core/src/store/index.ts` (Registry & Exports)

### 2. `Transport/` Layer (Future Proofing)

Instead of `Tunnel` and `Client` directly managing connections, introduce an optional `Transport` abstraction:

- **`TunnelTransport`**: Handles server-side (currently `ws`).
- **`ClientTransport`**: Handles browser-side (currently native `WebSocket`).
  This would allow us to implement native transport for **Bun**, **Node-HTTP**, or even niche ones like **WebRTC** in the future without changing the sync logic.

### 3. Client Reconnection Logic

Currently, `Client.ts` has reconnection logic embedded. We could extract this into its own `ReconnectionStrategy` module to allow for:

- Simple retries (current).
- Exponential backoff.
- Custom strategy (e.g., waiting for specific app states).

### 4. Middleware & Hooks

Introduce a middleware system for the **Signal Plane** and the **Data Plane**:

```typescript
tunnel.use((message, next) => {
    if (isAuthorized(message)) next();
});
```

---

## 📅 Roadmap

### Phase 1: Store Splitting

- [ ] Move `MemoryStore` and `RedisStore` into separate sub-modules.
- [ ] Ensure `Tunnel` uses dependency injection for its storage (mostly already doing this, but cleanup constructor).

### Phase 2: Transports & Connection Managers

- [ ] Separate connection lifecycle (status, errors, retries) from data sending (`Client.ts` cleanup).
- [ ] Extract `reconnect` logic into a separate strategy class as an option.

### Phase 3: Plugin System

- [ ] Add `hooks` or `middleware` for `Tunnel` and `Channel` to allow for logging, auditing, and authentication logic via standard patterns.
