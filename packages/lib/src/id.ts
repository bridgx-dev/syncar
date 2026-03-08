/**
 * ID generation utilities
 */

import type { MessageId, ClientId, SubscriberId } from '@synca/types'

/**
 * Generate a unique message ID
 * Format: timestamp-randomString
 */
export function generateMessageId(): MessageId {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Generate a unique client ID
 * Format: client-timestamp-randomString
 */
export function generateClientId(): ClientId {
  return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generate a unique subscriber ID
 * Format: sub-timestamp-randomString
 */
export function generateSubscriberId(): SubscriberId {
  return `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generate a random alphanumeric string
 * @param length - Length of the string to generate
 */
export function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Validate if a string is a valid message ID
 * Format: timestamp-randomString (e.g., "1234567890-abc123")
 */
export function isValidMessageId(id: string): id is MessageId {
  return /^\d+-[a-z0-9]+$/.test(id)
}

/**
 * Validate if a string is a valid client ID
 */
export function isValidClientId(id: string): id is ClientId {
  return typeof id === 'string' && id.length > 0
}

/**
 * Validate if a string is a valid subscriber ID
 */
export function isValidSubscriberId(id: string): id is SubscriberId {
  return typeof id === 'string' && id.length > 0
}
