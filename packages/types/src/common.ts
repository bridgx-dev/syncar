/**
 * Common type definitions used across all Syncar packages
 * Platform-agnostic primitive types and identifiers
 */

/**
 * Message identifier
 */
export type MessageId = string

/**
 * Client identifier (e.g., WebSocket connection ID)
 */
export type ClientId = string

/**
 * Subscriber identifier (typically client ID)
 */
export type SubscriberId = string

/**
 * Channel name
 */
export type ChannelName = string

/**
 * Unix timestamp in milliseconds
 */
export type Timestamp = number

/**
 * Generic data payload for messages
 */
export type DataPayload<T = unknown> = T
