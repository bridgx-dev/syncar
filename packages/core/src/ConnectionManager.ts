import type { ClientOptions } from './types'

export interface BackoffStrategy {
  nextDelay(attempt: number): number
}

export class ExponentialBackoff implements BackoffStrategy {
  constructor(
    protected baseDelay: number = 1000,
    protected maxDelay: number = 30000,
    protected factor: number = 1.5,
  ) {}

  nextDelay(attempt: number): number {
    return Math.min(
      this.baseDelay * Math.pow(this.factor, attempt),
      this.maxDelay,
    )
  }
}

export class ConnectionManager {
  protected attemptCount = 0
  protected reconnectTimer?: any
  protected isExplicitlyDisconnected = false
  protected backoff: BackoffStrategy

  constructor(
    protected options: ClientOptions,
    protected connectFn: () => void,
    protected disconnectFn: () => void,
  ) {
    this.backoff = new ExponentialBackoff(options.reconnectInterval)
  }

  handleDisconnect() {
    if (this.isExplicitlyDisconnected || !this.options.reconnect) return
    if (this.attemptCount >= (this.options.maxReconnectAttempts || Infinity)) {
      console.warn('Synnel: Max reconnect attempts reached')
      return
    }

    if (this.reconnectTimer) return

    const delay = this.backoff.nextDelay(this.attemptCount)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.attemptCount++
      this.connectFn()
    }, delay)
  }

  reset() {
    this.attemptCount = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }

  destroy() {
    this.isExplicitlyDisconnected = true
    this.reset()
    this.disconnectFn()
  }
}
