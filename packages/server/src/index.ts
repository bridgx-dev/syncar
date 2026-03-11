/**
 * @syncar/server
 * Node.js server for Syncar real-time synchronization
 *
 * @description
 * High-performance WebSocket server with unified channel API,
 * middleware support, and full type safety.
 *
 * @packageDocumentation
 *
 * @example
 * ```ts
 * import { createSyncarServer } from '@syncar/server'
 * const server = createSyncarServer({ port: 3000 })
 * await server.start()
 *
 * const chat = server.createChannel('chat')
 * server.broadcast('Hello everyone!')
 * ```
 */

// ============================================================
// SERVER EXPORTS
// ============================================================
export { SyncarServer, createSyncarServer } from './server'
export { SyncarServer as Syncar } from './server'

// New unified channel API
export { Channel } from './channel'
export { ContextManager, createContext } from './context'

export {
    SyncarError,
    ConfigError,
    TransportError,
    ChannelError,
    ClientError,
    MessageError,
    ValidationError,
    StateError,
    MiddlewareRejectionError,
    MiddlewareExecutionError,
} from './errors'
export { WebSocketServerTransport } from './websocket'

export { CLOSE_CODES, ERROR_CODES } from './config'
export type { IServerOptions, IServerStats } from './server'

export type {
    IChannelState,
    IMessageHandler,
    ChannelOptions,
    ChannelFlow,
} from './channel'

export type {
    MessageId,
    ClientId,
    ChannelName,
    Timestamp,
    Message,
    DataMessage,
    SignalMessage,
    ErrorMessage,
    AckMessage,
    MessageType,
    SignalType,
    ErrorCode,
    IContext,
    IMiddleware,
} from './types'
