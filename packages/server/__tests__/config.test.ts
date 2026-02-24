/**
 * Config Tests
 */

import { describe, it, expect } from 'vitest'
import {
  BROADCAST_CHANNEL,
  CLOSE_CODES,
  ERROR_CODES,
  DEFAULT_MAX_SUBSCRIBERS,
  DEFAULT_HISTORY_SIZE,
} from '../src/config/index.js'
import {
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_PATH,
  DEFAULT_PING_INTERVAL,
  DEFAULT_PING_TIMEOUT,
  DEFAULT_MAX_PAYLOAD,
} from '../src/config/index.js'

describe('Config', () => {
  describe('constants', () => {
    describe('BROADCAST_CHANNEL', () => {
      it('should be __broadcast__', () => {
        expect(BROADCAST_CHANNEL).toBe('__broadcast__')
      })

      it('should be a string', () => {
        expect(typeof BROADCAST_CHANNEL).toBe('string')
      })
    })

    describe('CLOSE_CODES', () => {
      it('should have NORMAL close code', () => {
        expect(CLOSE_CODES.NORMAL).toBe(1000)
      })

      it('should have REJECTED close code', () => {
        expect(CLOSE_CODES.REJECTED).toBe(4001)
      })

      it('should have all close codes as numbers', () => {
        expect(typeof CLOSE_CODES.NORMAL).toBe('number')
        expect(typeof CLOSE_CODES.REJECTED).toBe('number')
      })
    })

    describe('ERROR_CODES', () => {
      it('should have REJECTED error code', () => {
        expect(ERROR_CODES.REJECTED).toBe('REJECTED')
      })

      it('should have MISSING_CHANNEL error code', () => {
        expect(ERROR_CODES.MISSING_CHANNEL).toBe('MISSING_CHANNEL')
      })

      it('should have RATE_LIMITED error code', () => {
        expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
      })

      it('should have all error codes as strings', () => {
        expect(typeof ERROR_CODES.REJECTED).toBe('string')
        expect(typeof ERROR_CODES.MISSING_CHANNEL).toBe('string')
        expect(typeof ERROR_CODES.RATE_LIMITED).toBe('string')
      })
    })

    describe('DEFAULT_MAX_SUBSCRIBERS', () => {
      it('should be 0 (unlimited)', () => {
        expect(DEFAULT_MAX_SUBSCRIBERS).toBe(0)
      })

      it('should be a number', () => {
        expect(typeof DEFAULT_MAX_SUBSCRIBERS).toBe('number')
      })
    })

    describe('DEFAULT_HISTORY_SIZE', () => {
      it('should be 0 (no history)', () => {
        expect(DEFAULT_HISTORY_SIZE).toBe(0)
      })

      it('should be a number', () => {
        expect(typeof DEFAULT_HISTORY_SIZE).toBe('number')
      })
    })
  })

  describe('defaults', () => {
    describe('DEFAULT_PORT', () => {
      it('should be 3000', () => {
        expect(DEFAULT_PORT).toBe(3000)
      })

      it('should be a number', () => {
        expect(typeof DEFAULT_PORT).toBe('number')
      })
    })

    describe('DEFAULT_HOST', () => {
      it('should be 0.0.0.0', () => {
        expect(DEFAULT_HOST).toBe('0.0.0.0')
      })

      it('should be a string', () => {
        expect(typeof DEFAULT_HOST).toBe('string')
      })
    })

    describe('DEFAULT_PATH', () => {
      it('should be /synnel', () => {
        expect(DEFAULT_PATH).toBe('/synnel')
      })

      it('should be a string', () => {
        expect(typeof DEFAULT_PATH).toBe('string')
      })

      it('should start with a slash', () => {
        expect(DEFAULT_PATH.startsWith('/')).toBe(true)
      })
    })

    describe('DEFAULT_PING_INTERVAL', () => {
      it('should be 30000 (30 seconds)', () => {
        expect(DEFAULT_PING_INTERVAL).toBe(30000)
      })

      it('should be a number', () => {
        expect(typeof DEFAULT_PING_INTERVAL).toBe('number')
      })
    })

    describe('DEFAULT_PING_TIMEOUT', () => {
      it('should be 5000 (5 seconds)', () => {
        expect(DEFAULT_PING_TIMEOUT).toBe(5000)
      })

      it('should be a number', () => {
        expect(typeof DEFAULT_PING_TIMEOUT).toBe('number')
      })

      it('should be less than ping interval', () => {
        expect(DEFAULT_PING_TIMEOUT).toBeLessThan(DEFAULT_PING_INTERVAL)
      })
    })

    describe('DEFAULT_MAX_PAYLOAD', () => {
      it('should be 1048576 (1MB)', () => {
        expect(DEFAULT_MAX_PAYLOAD).toBe(1048576)
      })

      it('should be a number', () => {
        expect(typeof DEFAULT_MAX_PAYLOAD).toBe('number')
      })

      it('should be positive', () => {
        expect(DEFAULT_MAX_PAYLOAD).toBeGreaterThan(0)
      })
    })
  })

  describe('type consistency', () => {
    it('should have all close codes as valid WebSocket close codes', () => {
      // WebSocket close codes must be in range 1000-4999
      expect(CLOSE_CODES.NORMAL).toBeGreaterThanOrEqual(1000)
      expect(CLOSE_CODES.NORMAL).toBeLessThan(5000)
      expect(CLOSE_CODES.REJECTED).toBeGreaterThanOrEqual(1000)
      expect(CLOSE_CODES.REJECTED).toBeLessThan(5000)
    })

    it('should have ping interval greater than timeout', () => {
      expect(DEFAULT_PING_INTERVAL).toBeGreaterThan(DEFAULT_PING_TIMEOUT)
    })

    it('should have default values as non-negative numbers', () => {
      expect(DEFAULT_PORT).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_MAX_SUBSCRIBERS).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_HISTORY_SIZE).toBeGreaterThanOrEqual(0)
    })
  })

  describe('export consistency', () => {
    it('should export BROADCAST_CHANNEL with correct value', () => {
      expect(BROADCAST_CHANNEL).toBeDefined()
      expect(BROADCAST_CHANNEL).toBe('__broadcast__')
    })

    it('should export all CLOSE_CODES', () => {
      expect(CLOSE_CODES).toHaveProperty('NORMAL')
      expect(CLOSE_CODES).toHaveProperty('REJECTED')
    })

    it('should export all ERROR_CODES', () => {
      expect(ERROR_CODES).toHaveProperty('REJECTED')
      expect(ERROR_CODES).toHaveProperty('MISSING_CHANNEL')
      expect(ERROR_CODES).toHaveProperty('RATE_LIMITED')
    })

    it('should export all defaults', () => {
      expect(DEFAULT_PORT).toBeDefined()
      expect(DEFAULT_HOST).toBeDefined()
      expect(DEFAULT_PATH).toBeDefined()
      expect(DEFAULT_PING_INTERVAL).toBeDefined()
      expect(DEFAULT_PING_TIMEOUT).toBeDefined()
      expect(DEFAULT_MAX_PAYLOAD).toBeDefined()
    })
  })
})
