/**
 * ID generation utilities tests
 */

import { describe, it, expect } from 'vitest'
import {
  generateMessageId,
  generateClientId,
  generateSubscriberId,
  randomString,
  isValidMessageId,
  isValidClientId,
  isValidSubscriberId,
} from '../id.js'

describe('id', () => {
  describe('generateMessageId', () => {
    it('generates unique message IDs', () => {
      const id1 = generateMessageId()
      const id2 = generateMessageId()

      expect(id1).not.toBe(id2)
    })

    it('generates valid message ID format', () => {
      const id = generateMessageId()

      expect(isValidMessageId(id)).toBe(true)
      expect(id).toMatch(/^\d+-[a-z0-9]+$/)
    })
  })

  describe('generateClientId', () => {
    it('generates unique client IDs', () => {
      const id1 = generateClientId()
      const id2 = generateClientId()

      expect(id1).not.toBe(id2)
    })

    it('generates valid client ID format', () => {
      const id = generateClientId()

      expect(isValidClientId(id)).toBe(true)
      expect(id).toMatch(/^client-\d+-[a-z0-9]+$/)
    })
  })

  describe('generateSubscriberId', () => {
    it('generates unique subscriber IDs', () => {
      const id1 = generateSubscriberId()
      const id2 = generateSubscriberId()

      expect(id1).not.toBe(id2)
    })

    it('generates valid subscriber ID format', () => {
      const id = generateSubscriberId()

      expect(isValidSubscriberId(id)).toBe(true)
      expect(id).toMatch(/^sub-\d+-[a-z0-9]+$/)
    })
  })

  describe('randomString', () => {
    it('generates string of correct length', () => {
      expect(randomString(5)).toHaveLength(5)
      expect(randomString(10)).toHaveLength(10)
    })

    it('generates only alphanumeric characters', () => {
      const str = randomString(100)

      expect(str).toMatch(/^[a-z0-9]+$/)
    })
  })

  describe('isValidMessageId', () => {
    it('returns true for valid message IDs', () => {
      expect(isValidMessageId('1234567890-abc123')).toBe(true)
      expect(isValidMessageId('1-a')).toBe(true)
    })

    it('returns false for invalid message IDs', () => {
      expect(isValidMessageId('')).toBe(false)
      expect(isValidMessageId('no-dash')).toBe(false)
      expect(isValidMessageId('-start')).toBe(false)
      expect(isValidMessageId('end-')).toBe(false)
    })
  })

  describe('isValidClientId', () => {
    it('returns true for valid client IDs', () => {
      expect(isValidClientId('client-123')).toBe(true)
      expect(isValidClientId('any-string')).toBe(true)
    })

    it('returns false for invalid client IDs', () => {
      expect(isValidClientId('')).toBe(false)
    })
  })
})
