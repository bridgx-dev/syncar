/**
 * Connection Manager
 * Manages connection state and reconnection logic with exponential backoff
 */

import type { Transport } from './types.js'
import type { ClientStatus, ClientConfig } from './types.js'
import { createDefaultLogger, type LoggerFn, type LogLevel } from '@synnel/lib'

/**
 * Reconnection state
 */
interface ReconnectionState {
  attempts: number
  currentDelay: number
  timeoutId: ReturnType<typeof setTimeout> | null
  enabled: boolean
}

/**
 * Connection Manager
 * Handles connection lifecycle and reconnection with exponential backoff
 */
export class ConnectionManager {
  private _status: ClientStatus = 'disconnected'
  private reconnectionState: ReconnectionState = {
    attempts: 0,
    currentDelay: 0,
    timeoutId: null,
    enabled: false,
  }

  private readonly config: Required<
    Pick<
      ClientConfig,
      | 'autoReconnect'
      | 'maxReconnectAttempts'
      | 'reconnectDelay'
      | 'maxReconnectDelay'
      | 'debug'
      | 'logger'
    >
  > & { transport: Transport }

  private statusChangeHandlers: Set<(status: ClientStatus) => void> = new Set()
  private reconnectHandlers: Set<(attempt: number) => void> = new Set()
  private readonly logger: LoggerFn

  constructor(config: ClientConfig) {
    // Create or adapt logger to LoggerFn type
    const rawLogger = config.logger ?? createDefaultLogger('Synnel Client')
    this.logger = ((level: LogLevel, message: string, ...args: unknown[]) => {
      // Filter out debug messages if debug is disabled
      if (level === 'debug' && !config.debug) {
        return
      }
      // Call the user's logger (which doesn't support 'debug')
      rawLogger(level as 'info' | 'warn' | 'error', message, ...args)
    }) as LoggerFn

    this.config = {
      transport: config.transport,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      debug: config.debug ?? false,
      logger: rawLogger,
    }

    this.reconnectionState = {
      attempts: 0,
      currentDelay: this.config.reconnectDelay,
      timeoutId: null,
      enabled: this.config.autoReconnect,
    }
  }

  /**
   * Current connection status
   */
  get status(): ClientStatus {
    return this._status
  }

  /**
   * Connect using the transport
   */
  async connect(): Promise<void> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return
    }

    this.clearReconnection()

    try {
      this.setStatus('connecting')
      await this.config.transport.connect()
      this.setStatus('connected')

      // Reset reconnection state on successful connection
      this.reconnectionState.attempts = 0
      this.reconnectionState.currentDelay = this.config.reconnectDelay
    } catch (error) {
      this.setStatus('disconnected')
      this.logger('error', 'Connection failed', error)

      if (this.reconnectionState.enabled) {
        this.scheduleReconnect()
      }

      throw error
    }
  }

  /**
   * Disconnect from the transport
   */
  async disconnect(): Promise<void> {
    this.clearReconnection()

    if (this._status === 'disconnected') {
      return
    }

    this.setStatus('disconnecting')

    try {
      await this.config.transport.disconnect()
      this.setStatus('disconnected')
    } catch (error) {
      this.setStatus('disconnected')
      this.logger('error', 'Disconnect error', error)
      throw error
    }
  }

  /**
   * Handle transport close event
   */
  onTransportClose(event?: { code?: number; reason?: string }): void {
    const wasConnected = this._status === 'connected'

    this.setStatus('disconnected')

    if (
      wasConnected &&
      this.reconnectionState.enabled &&
      this.reconnectionState.attempts < this.config.maxReconnectAttempts
    ) {
      this.scheduleReconnect()
    }
  }

  /**
   * Handle transport error event
   */
  onTransportError(error: Error): void {
    this.logger('error', 'Transport error', error)

    if (this._status === 'connected') {
      // Error while connected - might be a transient issue
      // Let the close event handle reconnection
    } else if (this._status === 'connecting') {
      // Error while connecting
      this.setStatus('disconnected')

      if (this.reconnectionState.enabled) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * Register a status change handler
   */
  onStatusChange(handler: (status: ClientStatus) => void): () => void {
    this.statusChangeHandlers.add(handler)
    return () => {
      this.statusChangeHandlers.delete(handler)
    }
  }

  /**
   * Register a reconnect handler
   */
  onReconnecting(handler: (attempt: number) => void): () => void {
    this.reconnectHandlers.add(handler)
    return () => {
      this.reconnectHandlers.delete(handler)
    }
  }

  /**
   * Enable or disable auto-reconnect
   */
  setAutoReconnect(enabled: boolean): void {
    this.reconnectionState.enabled = enabled

    if (!enabled) {
      this.clearReconnection()
    }
  }

  /**
   * Get reconnection state
   */
  getReconnectionState(): {
    enabled: boolean
    attempts: number
    currentDelay: number
    maxAttempts: number
  } {
    return {
      enabled: this.reconnectionState.enabled,
      attempts: this.reconnectionState.attempts,
      currentDelay: this.reconnectionState.currentDelay,
      maxAttempts: this.config.maxReconnectAttempts,
    }
  }

  /**
   * Reset reconnection state
   */
  private clearReconnection(): void {
    if (this.reconnectionState.timeoutId) {
      clearTimeout(this.reconnectionState.timeoutId)
      this.reconnectionState.timeoutId = null
    }
    this.reconnectionState.attempts = 0
    this.reconnectionState.currentDelay = this.config.reconnectDelay
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.reconnectionState.enabled) {
      return
    }

    if (this.reconnectionState.attempts >= this.config.maxReconnectAttempts) {
      this.logger(
        'warn',
        `Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`,
      )
      return
    }

    this.reconnectionState.attempts++
    const delay = this.reconnectionState.currentDelay

    this.logger(
      'info',
      `Reconnection attempt ${this.reconnectionState.attempts}/${this.config.maxReconnectAttempts} in ${delay}ms`,
    )

    this.reconnectionState.timeoutId = setTimeout(async () => {
      try {
        this.setStatus('reconnecting')

        // Notify handlers
        for (const handler of this.reconnectHandlers) {
          try {
            handler(this.reconnectionState.attempts)
          } catch (error) {
            this.logger('error', 'Reconnect handler error', error)
          }
        }

        await this.config.transport.connect()
        this.setStatus('connected')

        // Reset reconnection state on success
        this.reconnectionState.attempts = 0
        this.reconnectionState.currentDelay = this.config.reconnectDelay
      } catch (error) {
        this.logger('error', 'Reconnection failed', error)
        this.setStatus('disconnected')

        // Schedule next attempt
        this.scheduleReconnect()
      }
    }, delay)

    // Exponential backoff with jitter
    const jitter = Math.random() * 0.3 * this.reconnectionState.currentDelay
    this.reconnectionState.currentDelay = Math.min(
      this.reconnectionState.currentDelay * 2 + jitter,
      this.config.maxReconnectDelay,
    )
  }

  /**
   * Update status and notify handlers
   */
  private setStatus(status: ClientStatus): void {
    if (this._status !== status) {
      this._status = status
      this.logger('info', `Status changed: ${status}`)

      for (const handler of this.statusChangeHandlers) {
        try {
          handler(status)
        } catch (error) {
          this.logger('error', 'Status change handler error', error)
        }
      }
    }
  }
}
