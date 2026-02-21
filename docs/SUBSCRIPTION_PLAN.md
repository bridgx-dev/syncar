# Planning: Subscription-Based Support (Signal Plane)

Currently, **Synnel** uses a broadcast model if no store is present, or a relay model if a store is present. However, clients do not explicitly notify the server when they are listening to a channel. This leads to inefficient bandwidth usage (server sending everything to everyone) or a complete lack of message delivery if `targeted relay` is enabled but no subscriptions exist.

## Goals

- **Bandwidth Optimization**: Only send data to clients who explicitly subscribed to a channel.
- **Persistent Subscriptions**: Automatically re-subscribe to channels after a client reconnections.
- **Reference Counting**: Only maintain a subscription on the server if at least one listener is active on the client.

---

## Architecture Changes (Modularity Update)

### 1. `TunnelBase` & `TunnelMessage` (types/index.ts)

- Add `abstract subscribe(channel: string): void` and `abstract unsubscribe(channel: string): void` to `TunnelBase`.
- Ensure `TunnelMessage` explicitly supports `type: 'signal'` for the control plane.

### 2. `Client` (packages/core/src/Client.ts)

- **State**: Maintain a `Set<string>` of `activeSubscriptions`.
- **Logic**:
  - `subscribe(channel)`: Adds to `Set` and sends signal via `transport.send`.
  - `unsubscribe(channel)`: Removes from `Set` and sends signal.
  - **Recovery**: On `onStatusChange` to `'open'`, iterate through `activeSubscriptions` and re-send signals.

### 3. `Channel` (packages/core/src/Channel.ts)

- **Reference Counting**:
  - When `listeners.size` goes $0 \to 1$, call `tunnel.subscribe(this.name)`.
  - When `listeners.size` goes $1 \to 0$, call `tunnel.unsubscribe(this.name)`.

### 4. `Tunnel` (packages/core/src/Tunnel.ts)

- **Signal Handling**: The `Dispatcher` will route messages with `type: 'signal'` to a dedicated handler.
- **Store Mapping**: Effectively calls `this.store.subscribe(clientId, channel)` using the `clientId` mapped in `socketToId`.
- **Defaulting**: Ensure `MemoryStore` is initialized if no storage is provided, so that "targeted relay" works out of the box.

---

## 📅 Roadmap

### Phase 1: Core Signal support

- [ ] Add `subscribe`/`unsubscribe` to `TunnelBase`.
- [ ] Implement `subscribe`/`unsubscribe` in `Client.ts` with signal message sending.
- [ ] Implement `activeSubscriptions` tracking in `Client.ts`.
- [ ] Add re-subscription logic on `onopen`.

### Phase 2: Channel Integration

- [ ] Update `Channel.receive` to trigger `tunnel.subscribe()`.
- [ ] Update `Channel` listener cleanup to trigger `tunnel.unsubscribe()`.

### Phase 3: Server defaults

- [ ] Ensure `Tunnel` defaults to `MemoryStore` if `storage` is undefined to prevent "forgotten" broadcast fallback.
- [ ] Verify `signal` handling logic in `Tunnel.ts`.
