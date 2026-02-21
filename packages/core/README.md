# @synnel/core 🏗️

The core implementation of the Synnel real-time engine. Provides both the Server implementation (for Node.js) and the isomorphic Client implementation (for browsers and other environments).

## Features

- **Fluent Chained API**: Chain your subscription handlers for readable code.
- **Environment Isolation**: Separate browser/server exports to prevent Node-only packages like `ws` or `node:events` from leaking into Vite/Webpack bundles.
- **Multicast & Unicast**: Abstracted message targeting patterns.
- **Automatic Reconnection**: Robust reconnection logic with configurable backoff.
- **Secure by Default**: Optional strict mode for server-side channel governance.

## Installation

```bash
npm install @synnel/core
```

## Usage

### Server Setup

```typescript
import { Synnel } from '@synnel/core'
const synnel = new Synnel(nodeHttpServer)

synnel.multicast('chat').receive((data) => {
  console.log('Got data!', data)
})
```

### Client Setup (Vanilla JS)

```typescript
import { SynnelClient } from '@synnel/core/client'

const client = new SynnelClient('ws://localhost:3000')

const chat = client.subscribe('chat')
  .onMessage((data) => console.log('Update:', data))
  .onError((err) => console.error('Error!', err))

// Send data to the channel
chat.send({ text: 'Hello!' })

// Unsubscribe when done
const unsubscribe = chat.onMessage(...) // subscribe() returns an unsubscribe function
unsubscribe()
```

## Security

Use the `strict` option to prevent client-side channel creation:

```typescript
const synnel = new Synnel(server, { strict: true })
```

## License

MIT
