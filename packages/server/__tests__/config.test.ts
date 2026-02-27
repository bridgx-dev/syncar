/**
 * Config Tests
 * Tests for configuration constants and defaults
 */

import { describe, it, expect } from 'vitest'
import {
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
  DEFAULT_WS_PATH,
} from '../src/config/index.js'

describe('Config', () => {
  describe('constants', () => {
    it('should export BROADCAST_CHANNEL as __broadcast__', () => {
      expect(BROADCAST_CHANNEL).toBe('__broadcast__')
    })

    it('should export CLOSE_CODES', () => {
      expect(CLOSE_CODES.NORMAL).toBe(1000)
    })

    it('should export ERROR_CODES', () => {
      expect(ERROR_CODES.REJECTED).toBe('REJECTED')
      expect(ERROR_CODES.MISSING_CHANNEL).toBe('MISSING_CHANNEL')
    })
  })

  describe('defaults', () => {
    it('should export DEFAULT_PORT', () => {
      expect(DEFAULT_PORT).toBe(3000)
    })

    it('should export DEFAULT_HOST', () => {
      expect(DEFAULT_HOST).toBe('0.0.0.0')
    })

    it('should export DEFAULT_PATH', () => {
      expect(DEFAULT_PATH).toBe('/synnel')
    })

    it('should export DEFAULT_WS_PATH', () => {
      expect(DEFAULT_WS_PATH).toBe('/synnel')
    })

    it('should export DEFAULT_PING_INTERVAL', () => {
      expect(DEFAULT_PING_INTERVAL).toBe(30000)
    })

    it('should export DEFAULT_PING_TIMEOUT', () => {
      expect(DEFAULT_PING_TIMEOUT).toBe(5000)
    })

    it('should export DEFAULT_MAX_PAYLOAD', () => {
      expect(DEFAULT_MAX_PAYLOAD).toBe(1048576)
    })
  })
})
