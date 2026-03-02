/**
 * Reconnection and backoff utilities
 */

/**
 * Default reconnection delay in milliseconds
 */
export const DEFAULT_RECONNECT_DELAY = 1000

/**
 * Maximum reconnection delay in milliseconds
 */
export const DEFAULT_MAX_RECONNECT_DELAY = 30000

/**
 * Default backoff multiplier
 */
export const DEFAULT_BACKOFF_MULTIPLIER = 1.5

/**
 * Default jitter factor (30% of current delay)
 */
export const DEFAULT_JITTER_FACTOR = 0.3

/**
 * Reconnection strategy options
 */
export interface ReconnectionOptions {
  /** Initial delay in ms */
  initialDelay?: number
  /** Maximum delay in ms */
  maxDelay?: number
  /** Backoff multiplier */
  multiplier?: number
  /** Enable jitter (0-1) */
  jitterFactor?: number
}

/**
 * Calculate next reconnection delay with exponential backoff
 */
export function calculateBackoff(
  attempt: number,
  options: ReconnectionOptions = {},
): number {
  const {
    initialDelay = DEFAULT_RECONNECT_DELAY,
    maxDelay = DEFAULT_MAX_RECONNECT_DELAY,
    multiplier = DEFAULT_BACKOFF_MULTIPLIER,
    jitterFactor = DEFAULT_JITTER_FACTOR,
  } = options

  // Calculate base delay with exponential backoff
  const baseDelay = Math.min(
    initialDelay * Math.pow(multiplier, attempt),
    maxDelay,
  )

  // Add jitter if configured
  if (jitterFactor > 0) {
    const jitter = Math.random() * jitterFactor * baseDelay
    return Math.min(baseDelay + jitter, maxDelay)
  }

  return baseDelay
}

/**
 * Calculate delay with deterministic jitter
 * Uses a predictable jitter calculation for testing
 */
export function calculateBackoffWithJitter(
  attempt: number,
  seed: number,
  options: ReconnectionOptions = {},
): number {
  const {
    initialDelay = DEFAULT_RECONNECT_DELAY,
    maxDelay = DEFAULT_MAX_RECONNECT_DELAY,
    multiplier = DEFAULT_BACKOFF_MULTIPLIER,
    jitterFactor = DEFAULT_JITTER_FACTOR,
  } = options

  const baseDelay = Math.min(
    initialDelay * Math.pow(multiplier, attempt),
    maxDelay,
  )

  if (jitterFactor > 0) {
    // Pseudo-random jitter based on seed
    const jitter = ((seed * 9301 + 49297) % 233280) / 233280
    const jitterAmount = jitter * jitterFactor * baseDelay
    return Math.min(baseDelay + jitterAmount, maxDelay)
  }

  return baseDelay
}

/**
 * Check if reconnection should be attempted
 */
export function shouldReconnect(attempt: number, maxAttempts: number): boolean {
  return maxAttempts === Infinity || attempt < maxAttempts
}

/**
 * Reconnection state management
 */
export interface ReconnectionState {
  attempts: number
  currentDelay: number
  enabled: boolean
}

/**
 * Create initial reconnection state
 */
export function createInitialReconnectionState(
  enabled = true,
): ReconnectionState {
  return {
    attempts: 0,
    currentDelay: DEFAULT_RECONNECT_DELAY,
    enabled,
  }
}

/**
 * Update reconnection state for next attempt
 */
export function advanceReconnectionState(
  state: ReconnectionState,
  maxDelay: number = DEFAULT_MAX_RECONNECT_DELAY,
  multiplier: number = DEFAULT_BACKOFF_MULTIPLIER,
): ReconnectionState {
  const nextAttempt = state.attempts + 1
  const nextDelay = calculateBackoff(nextAttempt, {
    initialDelay: DEFAULT_RECONNECT_DELAY,
    maxDelay,
    multiplier,
    jitterFactor: DEFAULT_JITTER_FACTOR,
  })

  return {
    attempts: nextAttempt,
    currentDelay: nextDelay,
    enabled: state.enabled,
  }
}

/**
 * Reset reconnection state after successful connection
 */
export function resetReconnectionState(
  state: ReconnectionState,
): ReconnectionState {
  return {
    attempts: 0,
    currentDelay: DEFAULT_RECONNECT_DELAY,
    enabled: state.enabled,
  }
}
