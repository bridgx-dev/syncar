# Planning: Subscription-Based Support (Signal Plane)

Currently, **Synnel** uses a broadcast model if no store is present, or a relay model if a store is present. However, clients do not explicitly notify the server when they are listening to a channel. This leads to inefficient bandwidth usage (server sending everything to everyone) or a complete lack of message delivery if `targeted relay` is enabled but no subscriptions exist.

## Goals

- **Bandwidth Optimization**: Only send data to clients who explicitly subscribed to a channel.
- **Persistent Subscriptions**: Automatically re-subscribe to channels after a client reconnections.
- **Reference Counting**: Only maintain a subscription on the server if at least one listener is active on the client.

---

## Architecture Changes

### 1. `TunnelBase` (Interface)

Add `subscribe` and `unsubscribe` methods to the base interface to allow `Channel` to communicate subscription intent regardless of whether it's on a server or client.

### 2. `Client` (packages/core/src/Client.ts)

- **State**: Maintain a `Set<string>` of `activeSubscriptions`.
- **Logic**:
    - `subscribe(channel)`: Send a `signal` message with `type: 'signal', signal: 'subscribe', channel: '...'`.
    - `unsubscribe(channel)`: Send a `signal` message with `type: 'signal', signal: 'unsubscribe', channel: '...'`.
    - **Recovery**: On WebSocket `open`, iterate through `activeSubscriptions` and re-send subscribe signals.

### 3. `Channel` (packages/core/src/Channel.ts)

- **Reference Counting**:
    - When `receive(cb)` is called:
        - If `listeners.size` becomes 1, call `tunnel.subscribe(this.name)`.
    - When the returned `unsubscribe()` is called:
        - If `listeners.size` becomes 0, call `tunnel.unsubscribe(this.name)`.

### 4. `Tunnel` (packages/core/src/Tunnel.ts)

- Ensure that if `this.store` is NOT present, it still respects the "Signal Plane" to manage local subscription state or continues to fallback to broadcast intentionally.
- Recommendation: Make `MemoryStore` the default even if no options are passed, ensuring targeted relay is ALWAYS enabled.

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
