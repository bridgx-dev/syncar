/**
 * Validation utilities
 */

import type { ChannelName } from '@syncar/types'

const CHANNEL_NAME_MIN_LENGTH = 1
const CHANNEL_NAME_MAX_LENGTH = 128
const RESERVED_PREFIX = '__'

/**
 * Validate channel name
 * Channel names must be non-empty strings with reasonable length
 */
export function isValidChannelName(name: ChannelName): boolean {
  return (
    typeof name === 'string' &&
    name.length >= CHANNEL_NAME_MIN_LENGTH &&
    name.length <= CHANNEL_NAME_MAX_LENGTH
  )
}

/**
 * Check if channel name is reserved for system use
 * Reserved channel names start with '__'
 */
export function isReservedChannelName(name: ChannelName): boolean {
  return name.startsWith(RESERVED_PREFIX)
}

/**
 * Validate channel name is not reserved
 */
export function isNonReservedChannelName(name: ChannelName): boolean {
  return isValidChannelName(name) && !isReservedChannelName(name)
}

/**
 * Assert that channel name is valid
 * @throws Error if channel name is invalid
 */
export function assertValidChannelName(name: ChannelName): void {
  if (!isValidChannelName(name)) {
    throw new Error(
      `Invalid channel name: must be between ${CHANNEL_NAME_MIN_LENGTH} and ${CHANNEL_NAME_MAX_LENGTH} characters`,
    )
  }
  if (isReservedChannelName(name)) {
    throw new Error(
      `Reserved channel name: channel names starting with '${RESERVED_PREFIX}' are reserved for system use`,
    )
  }
}
