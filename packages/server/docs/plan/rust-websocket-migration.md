# Rust WebSocket Migration Plan

> **Objective**: Replace Node.js WebSocket implementation with Rust to reduce memory consumption and improve performance.
> **Target**: WebSocket transport layer and client registry
> **Current Memory Issues**: High V8 heap usage, per-client closure overhead, unbounded client connections, no memory limits

---

## Table of Contents

1. [Current Memory Analysis](#current-memory-analysis)
2. [Why Rust?](#why-rust)
3. [Architecture Options](#architecture-options)
4. [Recommended Approach](#recommended-approach)
5. [Technical Specification](#technical-specification)
6. [Implementation Phases](#implementation-phases)
7. [Memory Optimization Strategies](#memory-optimization-strategies)
8. [API Compatibility](#api-compatibility)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Considerations](#deployment-considerations)

---

## Current Memory Analysis

### Memory Hotspots Identified

| Component | Memory Impact | Current Implementation | Issue |
|-----------|---------------|------------------------|-------|
| **Client Connections** | High | `Map<ClientId, IClientConnection>` | Each connection stores full socket object + metadata |
| **Client Wrappers** | Medium-High | Closure-based `IServerClient` | Per-client closure overhead for `send()`/`disconnect()` |
| **Channel Subscriptions** | Medium | `Set<SubscriberId>` per channel | JavaScript object overhead per set entry |
| **Message History** | Variable | Array with push/shift | Unbounded growth if historySize not configured |
| **Event Handlers** | Low-Medium | EventEmitter with Sets | Handler registration overhead |
| **Ping/pong Tracking** | Low | Per-connection timestamps | Minor but adds up at scale |

### Estimated Memory Per Client

```
Base WebSocket object:    ~2-4 KB
Connection metadata:      ~200-500 bytes
Client wrapper closures:  ~1-2 KB
Event listener overhead:  ~100-200 bytes
Channel subscriptions:    ~50-100 bytes per channel

Estimated total:          ~4-7 KB per client
At 10,000 clients:        ~40-70 MB minimum (V8 overhead often 2-3x)
```

### Root Causes

1. **V8 Heap Overhead**: JavaScript objects have significant metadata overhead
2. **Closure Allocation**: Each client wrapper creates closures for methods
3. **Unbounded Growth**: No hard limits on connections or memory
4. **GC Pressure**: Frequent allocation/deallocation creates garbage collection pressure
5. **No Memory Pools**: No reuse of buffers or connection structures

---

## Why Rust?

### Memory Advantages

| Feature | Node.js/TypeScript | Rust | Improvement |
|---------|-------------------|------|-------------|
| **Object Size** | ~200-500 bytes overhead | ~0 overhead (zero-cost) | 95%+ reduction |
| **String Handling** | UTF-16, separate heap | Compact, inline when possible | 50-75% reduction |
| **Collections** | HashMap/Set with overhead | Optimized hash tables | 60-80% reduction |
| **Memory Control** | GC-managed, unpredictable | Manual/RAII, deterministic | Full control |
| **Stack Allocation** | Mostly heap | Stack when possible | Major reduction |
| **Zero-copy** | Rare (buffers only) | Common with lifetimes | Significant |

### Performance Benefits

- **Single-threaded async**: Tokio runtime vs Node.js event loop
- **Zero-copy parsing**: JSON deserialization directly to structs
- **No GC pauses**: Deterministic memory behavior
- **Better connection handling**: epoll/kqueue directly
- **Lower CPU**: More connections per CPU cycle

---

## Architecture Options

### Option 1: Full Rust Replacement (Recommended)

```
┌─────────────────────────────────────────────────────┐
│                   Node.js Layer                     │
│  (Server orchestration, business logic, channels)   │
└────────────────┬────────────────────────────────────┘
                 │ IPC / FFI (neon or napi-rs)
┌────────────────▼────────────────────────────────────┐
│                   Rust Layer                        │
│  ┌──────────────────────────────────────────────┐  │
│  │  WebSocket Server (tokio-tungstenite)        │  │
│  │  - Connection management                     │  │
│  │  - Message parsing/validation                │  │
│  │  - Ping/pong health checks                   │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Client Registry (dashmap/evmap)             │  │
│  │  - Concurrent client storage                 │  │
│  │  - Subscription tracking                     │  │
│  │  - Memory-limited growth                     │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Message Queue (crossbeam channels)          │  │
│  │  - Rust → Node.js message passing            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Pros**:
- Maximum memory efficiency
- Rust handles all connection overhead
- Proven performance gains
- Clean separation of concerns

**Cons**:
- More complex initial setup
- FFI/IPC boundary to manage
- Two runtime environments

**Memory Savings**: Estimated 70-85% reduction in connection overhead

---

### Option 2: Rust Client Registry Only

```
┌─────────────────────────────────────────────────────┐
│          Node.js WebSocket (ws library)             │
│  - Connection handling                              │
│  - Raw socket I/O                                   │
└────────────────┬────────────────────────────────────┘
                 │ FFI (napi-rs/neon)
┌────────────────▼────────────────────────────────────┐
│              Rust Client Registry                   │
│  - Client metadata storage                          │
│  - Subscription tracking                            │
│  - Memory management                                 │
│  - Query operations                                 │
└─────────────────────────────────────────────────────┘
```

**Pros**:
- Easier integration
- Less code to rewrite
- Significant memory savings in registry

**Cons**:
- Still limited by Node.js WebSocket overhead
- More FFI calls = more overhead

**Memory Savings**: Estimated 40-55% reduction

---

### Option 3: Standalone Rust Service (Sidecar)

```
┌──────────────────┐         ┌──────────────────┐
│   Node.js        │         │     Rust         │
│   Server         │◄───────►│   WebSocket      │
│                  │  TCP/   │   Service        │
│ (Business Logic) │  Unix   │                  │
│                  │  Socket │ (Connections)    │
└──────────────────┘         └──────────────────┘
```

**Pros**:
- Complete isolation
- Independent deployment
- Language-agnostic clients

**Cons**:
- Network overhead between services
- More complex deployment
- Additional failure modes

**Memory Savings**: Estimated 75-90% reduction

---

## Recommended Approach

### **Option 1: Full Rust Replacement with FFI**

This approach provides the best balance of memory savings and maintainability.

#### Technology Stack

```toml
# Cargo.toml - Rust dependencies
[dependencies]
# Async runtime
tokio = { version = "1.40", features = ["full", "tracing"] }
tokio-util = { version = "0.7", features = ["codec"] }

# WebSocket
tokio-tungstenite = "0.24"
futures-util = "0.3"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Concurrency
dashmap = "6.1"           # Concurrent HashMap
crossbeam-channel = "0.5" # Multi-producer channels
parking_lot = "0.12"      # Fast RwLock/Mutex

# FFI
napi = { version =3.0", features = ["async", "tokio_rt"] }
napi-derive = "3.0"

# Observability
tracing = "0.1"
tracing-subscriber = "0.3"
metrics = "0.23"

# Memory management
lru = "0.12"              # LRU cache for channels
```

---

## Technical Specification

### 1. Rust WebSocket Server

```rust
// Core structures with minimal memory footprint

#[repr(C)]
pub struct ClientConnection {
    id: ClientId,                    // 8 bytes (u64)
    socket_addr: SocketAddr,         // 28 bytes (IPv6)
    connected_at: u64,               // 8 bytes
    last_ping_at: u64,               // 8 bytes
    // Total: ~52 bytes + socket handle (pointer)
}

// Using Arc for shared, cloneable client references
pub type SharedClient = Arc<ClientConnection>;

// Concurrent client registry with dashmap
pub struct ClientRegistry {
    // O(1) concurrent access, no lock contention
    clients: DashMap<ClientId, SharedClient>,

    // Channel subscriptions: ClientId -> Set of channels
    // Using compact Vec for small subscription counts
    subscriptions: DashMap<ClientId, SmallVec<[ChannelName; 4]>>,

    // Reverse index: Channel -> Set of subscribers
    // Using DashSet for concurrent operations
    channel_subscribers: DashMap<ChannelName, DashSet<ClientId>>,

    // Memory limits
    max_clients: usize,
    max_subscriptions_per_client: usize,
}
```

**Memory Comparison**:
```
Node.js ClientConnection: ~2,500-4,000 bytes
Rust ClientConnection:    ~100-200 bytes
Improvement:              95%+ reduction
```

---

### 2. Message Protocol

```rust
// Zero-copy message parsing with serde

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SynnelMessage {
    DATA(DataMessage),
    SIGNAL(SignalMessage),
    ERROR(ErrorMessage),
    ACK(AckMessage),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataMessage {
    pub channel: CompactString,  // Inline string for short names
    pub data: serde_json::Value,
    pub timestamp: u64,
    pub id: CompactString,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignalMessage {
    pub signal: SignalType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<CompactString>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SignalType {
    PING,
    PONG,
    SUBSCRIBE,
    UNSUBSCRIBE,
}
```

---

### 3. Connection Handler

```rust
pub struct ConnectionHandler {
    registry: Arc<ClientRegistry>,
    message_tx: crossbeam_channel::Sender<NodeJsMessage>,
    config: Arc<HandlerConfig>,
}

impl ConnectionHandler {
    pub async fn handle_connection(
        &self,
        socket: WebSocketStream<UpgradedTcpStream>,
        addr: SocketAddr,
    ) -> Result<(), HandlerError> {
        // Generate client ID
        let client_id = self.generate_client_id();

        // Create connection with minimal allocation
        let connection = Arc::new(ClientConnection {
            id: client_id,
            socket_addr: addr,
            connected_at: now_millis(),
            last_ping_at: now_millis(),
        });

        // Register client (O(1) concurrent insert)
        self.registry.clients.insert(client_id, connection.clone());

        // Spawn message handling task
        let handler = self.clone();
        tokio::spawn(async move {
            handler.handle_messages(socket, connection).await;
        });

        Ok(())
    }

    async fn handle_messages(
        &self,
        mut socket: WebSocketStream<UpgradedTcpStream>,
        connection: Arc<ClientConnection>,
    ) {
        let mut ping_interval = tokio::time::interval(
            self.config.ping_interval
        );

        loop {
            tokio::select! {
                // Incoming message
                Some(msg) = socket.next() => {
                    match msg {
                        Ok(ws_msg) => self.process_message(
                            ws_msg, &connection, &mut socket
                        ).await,
                        Err(_) => break,
                    }
                }

                // Ping timeout check
                _ = ping_interval.tick() => {
                    if connection.should_timeout(self.config.ping_timeout) {
                        break;
                    }
                    socket.send(Message::Ping(vec![])).await.ok();
                }

                // Shutdown signal
                _ = self.shutdown_rx.recv() => break,
            }
        }

        self.cleanup_connection(&connection).await;
    }
}
```

---

### 4. Memory-Limited Registry

```rust
use lru::LruCache;
use std::sync::atomic::{AtomicUsize, Ordering};

pub struct MemoryLimitedRegistry {
    clients: DashMap<ClientId, ClientData>,
    channel_cache: Mutex<LruCache<ChannelName, ChannelData>>,

    // Atomic counters for fast checks
    client_count: AtomicUsize,
    total_subscriptions: AtomicUsize,

    // Configurable limits
    max_clients: usize,
    max_channels: usize,
    max_memory_bytes: usize,

    // Memory tracking
    current_memory: AtomicUsize,
}

impl MemoryLimitedRegistry {
    pub fn register(
        &self,
        client: ClientData,
    ) -> Result<ClientId, RegistryError> {
        // Fast atomic check before allocation
        if self.client_count.load(Ordering::Relaxed) >= self.max_clients {
            return Err(RegistryError::MaxClientsReached);
        }

        let estimated_size = client.estimated_size();
        if self.would_exceed_memory(estimated_size) {
            return Err(RegistryError::MemoryLimitExceeded);
        }

        // All checks passed - register
        let id = client.id;
        self.clients.insert(id, client);
        self.client_count.fetch_add(1, Ordering::Relaxed);
        self.current_memory.fetch_add(estimated_size, Ordering::Relaxed);

        Ok(id)
    }

    fn would_exceed_memory(&self, additional: usize) -> bool {
        let current = self.current_memory.load(Ordering::Relaxed);
        current + additional > self.max_memory_bytes
    }
}
```

---

### 5. FFI Bridge (Node.js ↔ Rust)

```rust
// napi-rs bindings for Node.js integration

#[napi]
pub struct RustWebSocketServer {
    inner: Arc<WebSocketServer>,
    runtime: Runtime,
}

#[napi]
impl RustWebSocketServer {
    #[napi(constructor)]
    pub fn new(config: ServerConfig) -> Result<Self, napi::Error> {
        let runtime = Runtime::new()?;
        let inner = runtime.block_on(async {
            WebSocketServer::new(config).await
        })?;

        Ok(Self { inner, runtime })
    }

    #[napi]
    pub async fn start(&self, port: u32) -> Result<u32, napi::Error> {
        self.inner.start(port).await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn broadcast(&self, channel: String, data: serde_json::Value) -> Result<(), napi::Error> {
        self.inner.broadcast(channel, data)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn get_client_count(&self) -> u32 {
        self.inner.client_count()
    }

    #[napi]
    pub fn get_memory_usage(&self) -> MemoryUsage {
        self.inner.memory_usage()
    }
}

#[napi(object)]
pub struct MemoryUsage {
    pub client_bytes: u64,
    pub channel_bytes: u64,
    pub total_bytes: u64,
    pub client_count: u32,
    pub channel_count: u32,
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Tasks**:
1. Set up Rust project with napi-rs
2. Define core data structures
3. Implement basic client registry
4. Create FFI bridge skeleton
5. Set up build tooling (npm scripts)

**Deliverables**:
- Working Rust FFI module
- Basic registry with CRUD operations
- Memory tracking infrastructure
- Build pipeline (cargo → npm)

**Memory Target**: N/A (foundation)

---

### Phase 2: WebSocket Implementation (Week 2-4)

**Tasks**:
1. Implement WebSocket server with tokio-tungstenite
2. Add connection lifecycle management
3. Implement ping/pong health checks
4. Add message parsing/validation
5. Create connection limits and backpressure

**Deliverables**:
- Full WebSocket server in Rust
- Connection acceptance/rejection
- Health monitoring
- Message processing pipeline

**Memory Target**: < 100 bytes per connection (vs 4-7 KB current)

---

### Phase 3: Enhanced Registry (Week 3-5)

**Tasks**:
1. Implement subscription tracking
2. Add channel management
3. Implement memory limits
4. Add client metadata queries
5. Create efficient broadcast/multicast

**Deliverables**:
- Complete client registry
- Subscription management
- Memory-limited growth
- Query API

**Memory Target**: 70-85% reduction in registry overhead

---

### Phase 4: Node.js Integration (Week 4-6)

**Tasks**:
1. Complete FFI bindings
2. Create TypeScript wrapper layer
3. Implement event forwarding (Rust → Node)
4. Add graceful shutdown
5. Create migration utilities

**Deliverables**:
- Drop-in replacement for current WebSocket transport
- API-compatible interface
- Event forwarding to Node.js layer
- Migration guide

**Memory Target**: 70-80% total reduction

---

### Phase 5: Testing & Optimization (Week 5-7)

**Tasks**:
1. Load testing (10k+ connections)
2. Memory profiling
3. Performance benchmarking
4. Leak detection
5. Optimization iterations

**Deliverables**:
- Performance benchmarks
- Memory usage reports
- Optimized hot paths
- Production-ready build

**Memory Target**: Verified 70-85% reduction under load

---

### Phase 6: Deployment (Week 7-8)

**Tasks**:
1. Create deployment documentation
2. Set up CI/CD for Rust builds
3. Create monitoring/metrics
4. Staged rollout plan
5. Rollback procedures

**Deliverables**:
- Deployment guide
- Automated builds
- Metrics dashboard
- Production deployment

---

## Memory Optimization Strategies

### 1. Data Structure Optimization

```rust
// Instead of: HashMap<String, ValueType>
// Use:      HashMap<CompactString, ValueType>
// Benefit:  Inline storage for strings < 23 bytes

// Instead of: Vec<ChannelName> for subscriptions
// Use:      SmallVec<[ChannelName; 4]>
// Benefit:  Stack allocation for ≤4 channels

// Instead of: Arc<Mutex<HashSet<T>>>
// Use:      DashSet<T>
// Benefit:  Lock-free concurrent access
```

### 2. Message Pooling

```rust
use object_pool::Pool;

pub struct MessagePool {
    pool: Pool<Vec<u8>>,
}

impl MessagePool {
    pub fn acquire_buffer(&self) -> Pooled<Vec<u8>> {
        self.pool.pull(|| Vec::with_capacity(4096))
    }
    // Reuses buffers instead of allocating new ones
}
```

### 3. Connection Limits

```rust
pub struct ConnectionLimiter {
    semaphore: Arc<Semaphore>,
    count: Arc<AtomicUsize>,
}

impl ConnectionLimiter {
    pub async fn acquire(&self) -> Result<Permit, LimitError> {
        // Fast-path: check count without waiting
        if self.count.load(Ordering::Relaxed) >= self.limit {
            return Err(LimitError::MaxConnections);
        }
        self.semaphore.acquire().await
    }
}
```

### 4. Lazy Allocation

```rust
// Don't allocate subscription storage until needed
pub struct ClientData {
    id: ClientId,
    connected_at: u64,
    // Only allocate when client subscribes
    subscriptions: Option<SmallVec<[ChannelName; 4]>>,
}
```

### 5. String Interning

```rust
use lru::LruCache;

pub struct StringInterner {
    cache: Mutex<LruCache<String, &'static str>>,
}

// Reuse common channel names (e.g., "broadcast", "notifications")
```

---

## API Compatibility

### TypeScript Interface (Drop-in Replacement)

```typescript
// packages/server/src/transport/rust-websocket-transport.ts

import { BaseTransport } from './base-transport'
import type { IServerTransport, IServerTransportConfig } from '../types'

// Load the native Rust module
import { RustWebSocketServer as NativeRustServer } from './native/index.node'

/**
 * Rust-backed WebSocket transport (drop-in replacement)
 * Maintains full API compatibility with WebSocketServerTransport
 */
export class RustWebSocketServerTransport
  extends BaseTransport
  implements IServerTransport
{
  private readonly native: NativeRustServer

  constructor(config: IServerTransportConfig) {
    super(config.connections ?? new Map())

    // Initialize Rust server
    this.native = new NativeRustServer({
      port: config.port ?? 3000,
      host: config.host ?? '0.0.0.0',
      path: config.path ?? '/synnel',
      maxPayload: config.maxPayload ?? 1_048_576,
      maxConnections: config.maxConnections ?? 10_000,
      pingInterval: config.pingInterval ?? 30_000,
      pingTimeout: config.pingTimeout ?? 5_000,
    })

    // Set up event forwarding from Rust to Node.js
    this.setupEventForwarding()
  }

  async start(): Promise<void> {
    // Start Rust server (non-blocking)
    await this.native.start()

    // The Rust server will call our callbacks for events
  }

  private setupEventForwarding(): void {
    // Register native callbacks
    this.native.onConnection((clientId: string, addr: string) => {
      const connection = {
        id: clientId as ClientId,
        socket: this.createRustSocketWrapper(clientId),
        connectedAt: Date.now(),
        lastPingAt: Date.now(),
      }
      this.connections.set(clientId as ClientId, connection)
      this.emit('connection', connection)
    })

    this.native.onMessage((clientId: string, message: unknown) => {
      this.emit('message', clientId as ClientId, message)
    })

    this.native.onDisconnection((clientId: string) => {
      this.emit('disconnection', clientId as ClientId)
      this.connections.delete(clientId as ClientId)
    })
  }

  async sendToClient(
    clientId: ClientId,
    message: Message,
  ): Promise<void> {
    await this.native.sendToClient(clientId, JSON.stringify(message))
  }

  stop(): void {
    this.native.stop()
    this.connections.clear()
    this.removeAllListeners()
  }

  private createRustSocketWrapper(clientId: ClientId) {
    return {
      send: (data: string, cb?: (err?: Error) => void) => {
        this.native.sendToClient(clientId, data)
          .then(() => cb?.())
          .catch((err) => cb?.(err))
      },
      close: () => this.native.disconnectClient(clientId),
    }
  }
}
```

---

## Testing Strategy

### 1. Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_registration_memory_limit() {
        let registry = ClientRegistry::with_limits(100, 1_000_000);

        // Register 100 clients
        for i in 0..100 {
            let client = create_test_client(i);
            assert!(registry.register(client).is_ok());
        }

        // 101st should fail
        let client = create_test_client(101);
        assert!(matches!(
            registry.register(client),
            Err(RegistryError::MaxClientsReached)
        ));
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let registry = Arc::new(ClientRegistry::new());
        let handles: Vec<_> = (0..100)
            .map(|i| {
                let registry = registry.clone();
                tokio::spawn(async move {
                    registry.subscribe(i, "test-channel".into())
                })
            })
            .collect();

        for handle in handles {
            handle.await.unwrap();
        }

        assert_eq!(registry.get_subscriber_count("test-channel"), 100);
    }
}
```

### 2. Integration Tests

```typescript
// __tests__/rust-transport.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RustWebSocketServerTransport } from '../src/transport/rust-websocket-transport'
import { WebSocket } from 'ws'

describe('Rust WebSocket Transport Integration', () => {
  let transport: RustWebSocketServerTransport
  const PORT = 19567

  beforeAll(async () => {
    transport = new RustWebSocketServerTransport({
      server: null,
      port: PORT,
      maxConnections: 100,
    })
    await transport.start()
  })

  afterAll(() => {
    transport.stop()
  })

  it('should handle 1000 concurrent connections', async () => {
    const clients = await Promise.all(
      Array.from({ length: 1000 }, (_, i) =>
        createWebSocketClient(PORT, `client-${i}`)
      )
    )

    expect(transport.getClientCount()).toBe(1000)

    // Cleanup
    await Promise.all(clients.map(c => c.close()))
  })

  it('should enforce memory limits', async () => {
    const usage = transport.getNativeMemoryUsage()
    expect(usage.clientBytes).toBeLessThan(1_000_000) // < 1MB for 1000 clients
  })
})
```

### 3. Load Testing

```typescript
// __tests__/load/stress.test.ts

import { createServer } from '../src'
import { createWebSocketClients } from './helpers'

describe('Load Tests', () => {
  it('should handle 10k connections with < 100MB memory', async () => {
    const server = createServer({
      rust: { enabled: true },
      limits: { maxConnections: 10_000 },
    })

    await server.start()

    const clients = await createWebSocketClients(10_000)

    const memoryBefore = process.memoryUsage().heapUsed
    const rustMemory = server.getNativeMemoryUsage()

    expect(rustMemory.totalBytes).toBeLessThan(50_000_000) // < 50MB

    // Cleanup
    await Promise.all(clients.map(c => c.close()))
    await server.stop()
  })
})
```

---

## Deployment Considerations

### Build Pipeline

```json
// package.json scripts
{
  "scripts": {
    "build:rust": "cd native && npm run build",
    "build:ts": "tsup",
    "build": "run-s build:rust build:ts",
    "prebuild": "npm run build:rust",
    "dev:rust": "cd native && npm run dev",
    "dev": "run-p dev:rust dev:ts",
    "test:rust": "cd native && cargo test",
    "test": "run-s test:rust test:ts"
  }
}
```

### Platform-Specific Builds

```toml
# native/.npmrc
rust_target_webasm32 = unknown
rust_target_wasm32 = unknown
rust_target_x86_64_pc_windows_msvc = true
rust_target_x86_64_apple_darwin = true
rust_target_x86_64_unknown_linux_gnu = true
rust_target_aarch64_apple_darwin = true
rust_target_aarch64_unknown_linux_gnu = true
```

### Monitoring

```rust
// Metrics to expose
pub struct ServerMetrics {
    // Connection metrics
    pub active_connections: u64,
    pub total_connections: u64,
    pub rejected_connections: u64,

    // Memory metrics
    pub client_memory_bytes: u64,
    pub channel_memory_bytes: u64,
    pub total_memory_bytes: u64,

    // Message metrics
    pub messages_received: u64,
    pub messages_sent: u64,
    pub parse_errors: u64,

    // Performance metrics
    pub avg_message_latency_us: u64,
    pub p99_message_latency_us: u64,
}
```

### Rollout Strategy

1. **Phase 1**: Deploy to staging with 10% traffic
2. **Phase 2**: Deploy to production with feature flag
3. **Phase 3**: Gradual ramp (10% → 50% → 100%)
4. **Phase 4**: Monitor and validate memory improvements
5. **Phase 5**: Remove old implementation

---

## Expected Results

### Memory Improvements

| Metric | Current (Node.js) | Target (Rust) | Improvement |
|--------|------------------|---------------|-------------|
| **Per-client memory** | 4-7 KB | 100-200 bytes | 95%+ |
| **10k connections** | 40-70 MB | 1-2 MB | 95%+ |
| **Registry overhead** | 5-10 MB | 500 KB - 1 MB | 90%+ |
| **Message buffer** | Variable | Fixed, pooled | 70%+ |
| **Total @ 10k clients** | 50-100 MB | 5-10 MB | 90%+ |

### Performance Improvements

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Max connections** | ~10k (memory limited) | 100k+ | 10x+ |
| **Connection setup** | ~5ms | ~1ms | 5x |
| **Message latency p99** | ~10ms | ~2ms | 5x |
| **GC pauses** | 10-50ms | 0ms | ∞ |

---

## Migration Checklist

### Pre-Migration
- [ ] Profile current memory usage
- [ ] Document current behavior
- [ ] Set up monitoring
- [ ] Create backup/rollback plan

### Implementation
- [ ] Set up Rust project
- [ ] Implement WebSocket server
- [ ] Implement client registry
- [ ] Create FFI bindings
- [ ] Write tests

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Load tests meet targets
- [ ] Memory profiling complete
- [ ] No memory leaks detected

### Deployment
- [ ] Staging deployment successful
- [ ] Documentation complete
- [ ] Team trained
- [ ] Production rollout
- [ ] Monitor and validate

---

## Resources

### Rust Crates
- [tokio](https://tokio.rs/) - Async runtime
- [tokio-tungstenite](https://github.com/snapview/tokio-tungstenite) - WebSocket
- [dashmap](https://github.com/xacrimon/dashmap) - Concurrent HashMap
- [napi-rs](https://napi.rs/) - Node.js FFI
- [serde](https://serde.rs/) - Serialization

### Documentation
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [napi-rs Guide](https://napi.rs/docs/)

### Similar Projects
- [socket.io-rust](https://github.com/Totodore/socket.io-rust) - Rust Socket.IO implementation
- [actix-web](https://github.com/actix/actix-web) - High-performance Rust web framework
- [tungstenite](https://github.com/snapview/tungstenite-rs) - Lightweight WebSocket implementation

---

*Last Updated: 2026-02-26*
*Status: Planning*
*Owner: Server Team*
