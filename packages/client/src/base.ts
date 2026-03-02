/**
 * WebSocket Client Transport
 * Client-side WebSocket transport for browser and Node.js environments
 */

import type { ConnectionStatus, Message } from '@synnel/types'
import type {
  Transport,
  TransportEventType,
  TransportEventMap,
  TransportCloseEvent,
  ClientTransportConfig,
} from './types.js'

/**
 * Reconnection state
 */
interface ReconnectionState {
  /**
   * Number of reconnection attempts
   */
  attempts: number

  /**
   * Current delay in ms
   */
  currentDelay: number

  /**
   * Whether reconnection is enabled
   */
  enabled: boolean

  /**
   * Timeout ID for next attempt
   */
  timeoutId?: ReturnType<typeof setTimeout>
}

/**
 * WebSocket Client Transport
 * Implements the Transport interface using native WebSocket API
 */
export class WebSocketClientTransport implements Transport {
  private ws: WebSocket | null = null
  private _status: ConnectionStatus = 'disconnected'

  // Event handlers map
  private eventHandlers = new Map<
    TransportEventType,
    Set<TransportEventMap[TransportEventType]>
  >()

  private reconnectionState: ReconnectionState
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null
  private connectedAt: number | null = null

  private readonly config: Required<
    Omit<ClientTransportConfig, 'WebSocketConstructor'>
  >
  private readonly WebSocketImpl: typeof WebSocket

  constructor(config: ClientTransportConfig) {
    this.config = {
      url: config.url,
      reconnect: config.reconnect ?? false,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      connectionTimeout: config.connectionTimeout ?? 10000,
    }
    this.WebSocketImpl =
      (config.WebSocketConstructor as typeof WebSocket) ?? WebSocket

    this.reconnectionState = {
      attempts: 0,
      currentDelay: this.config.reconnectDelay,
      enabled: this.config.reconnect,
    }
  }

  get status(): ConnectionStatus {
    return this._status
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return
    }

    this._status = 'connecting'

    try {
      await this.createConnection()
    } catch (error) {
      this._status = 'disconnected'
      this.emit('error', error as Error)

      if (this.reconnectionState.enabled) {
        this.scheduleReconnect()
      }

      throw error
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  async disconnect(): Promise<void> {
    // Clear any pending reconnection
    this.clearReconnection()

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = null
    }

    if (this.ws && this._status !== 'disconnected') {
      this._status = 'disconnecting'
      this.ws.close(1000, 'Client disconnect')

      // Wait for close event
      await new Promise<void>((resolve) => {
        const checkStatus = () => {
          if (this._status === 'disconnected') {
            resolve()
          } else {
            setTimeout(checkStatus, 10)
          }
        }
        checkStatus()
      })
    }
  }

  /**
   * Send a message through the WebSocket
   */
  async send(message: Message): Promise<void> {
    if (this._status !== 'connected' || !this.ws) {
      throw new Error(`Cannot send message: transport is ${this._status}`)
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      this.emit('error', error as Error)
      throw error
    }
  }

  /**
   * Register an event handler
   */
  on<E extends TransportEventType>(
    event: E,
    handler: TransportEventMap[E],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }

    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.add(handler as any)
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event)
      if (handlers) {
        handlers.delete(handler as any)
      }
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): { connectedAt?: number; url: string } {
    return {
      connectedAt: this.connectedAt ?? undefined,
      url: this.config.url,
    }
  }

  /**
   * Create a new WebSocket connection
   */
  private async createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new this.WebSocketImpl(this.config.url)

        // Set up connection timeout
        this.connectionTimeoutId = setTimeout(() => {
          if (this.ws && this.ws.readyState === this.WebSocketImpl.CONNECTING) {
            this.ws.close()
            reject(new Error('Connection timeout'))
          }
        }, this.config.connectionTimeout)

        this.ws!.onopen = () => {
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId)
            this.connectionTimeoutId = null
          }

          this._status = 'connected'
          this.connectedAt = Date.now()

          // Reset reconnection state on successful connection
          this.reconnectionState.attempts = 0
          this.reconnectionState.currentDelay = this.config.reconnectDelay

          this.emit('open')
          resolve()
        }

        this.ws!.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data as string) as Message
            this.emit('message', message)
          } catch (error) {
            this.emit(
              'error',
              new Error(`Failed to parse message: ${event.data}`),
            )
          }
        }

        this.ws!.onerror = (_event: Event) => {
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId)
            this.connectionTimeoutId = null
          }

          const error = new Error('WebSocket error')
          this.emit('error', error)

          if (this._status === 'connecting') {
            reject(error)
          }
        }

        this.ws!.onclose = (event: CloseEvent) => {
          if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId)
            this.connectionTimeoutId = null
          }

          this._status = 'disconnected'
          this.connectedAt = null

          const closeEvent: TransportCloseEvent = {
            wasClean: event.wasClean,
            code: event.code,
            reason: event.reason,
          }

          this.emit('close', closeEvent)

          // Attempt reconnection if enabled and not a normal close
          if (
            this.reconnectionState.enabled &&
            event.code !== 1000 &&
            this.reconnectionState.attempts < this.config.maxReconnectAttempts
          ) {
            this.scheduleReconnect()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.reconnectionState.enabled) {
      return
    }

    this.reconnectionState.attempts++
    this.reconnectionState.timeoutId = setTimeout(() => {
      this._status = 'connecting'
      this.createConnection()
        .then(() => {
          // Connection successful
        })
        .catch(() => {
          // Will trigger another reconnection if attempts remain
        })
    }, this.reconnectionState.currentDelay)

    // Exponential backoff with jitter
    const jitter = Math.random() * 0.3 * this.reconnectionState.currentDelay
    this.reconnectionState.currentDelay = Math.min(
      this.reconnectionState.currentDelay * 2 + jitter,
      this.config.maxReconnectDelay,
    )
  }

  /**
   * Clear pending reconnection
   */
  private clearReconnection(): void {
    if (this.reconnectionState.timeoutId) {
      clearTimeout(this.reconnectionState.timeoutId)
      this.reconnectionState.timeoutId = undefined
    }
    this.reconnectionState.attempts = 0
    this.reconnectionState.currentDelay = this.config.reconnectDelay
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit<E extends TransportEventType>(
    event: E,
    ...args: Parameters<TransportEventMap[E]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          ;(handler as any)(...args)
        } catch (error) {
          console.error(`Error in ${event} handler:`, error)
        }
      }
    }
  }
}
