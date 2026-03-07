/**
 * Client Types
 * Types for client management and server-side client representation.
 */

import type { ClientId } from './common'

// ============================================================
// DISCONNECTION EVENT
// ============================================================

/**
 * Disconnection event data
 * Emitted when a client disconnects from the server.
 */
export interface IDisconnectionEvent {
  /** Client ID that disconnected */
  clientId: ClientId

  /** WebSocket close code (if available) */
  code?: number

  /** Close reason string (if available) */
  reason?: string
}
