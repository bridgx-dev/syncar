/**
 * Validation utilities tests
 */

import { describe, it, expect } from 'vitest'
import {
  isValidChannelName,
  isReservedChannelName,
  isNonReservedChannelName,
  assertValidChannelName,
} from '../validation.js'

describe('validation', () => {
  describe('isValidChannelName', () => {
    it('accepts valid channel names', () => {
      expect(isValidChannelName('chat')).toBe(true)
      expect(isValidChannelName('user-123')).toBe(true)
      expect(isValidChannelName('a')).toBe(true)
      expect(isValidChannelName('x'.repeat(128))).toBe(true)
    })

    it('rejects invalid channel names', () => {
      expect(isValidChannelName('')).toBe(false)
      expect(isValidChannelName('x'.repeat(129))).toBe(false)
    })
  })

  describe('isReservedChannelName', () => {
    it('returns true for reserved channel names', () => {
      expect(isReservedChannelName('__system')).toBe(true)
      expect(isReservedChannelName('__internal')).toBe(true)
      expect(isReservedChannelName('__')).toBe(true)
    })

    it('returns false for non-reserved channel names', () => {
      expect(isReservedChannelName('chat')).toBe(false)
      expect(isReservedChannelName('_private')).toBe(false)
      expect(isReservedChannelName('__invalid')).toBe(true)
    })
  })

  describe('isNonReservedChannelName', () => {
    it('accepts valid non-reserved channel names', () => {
      expect(isNonReservedChannelName('chat')).toBe(true)
      expect(isNonReservedChannelName('user-123')).toBe(true)
    })

    it('rejects reserved channel names', () => {
      expect(isNonReservedChannelName('__system')).toBe(false)
      expect(isNonReservedChannelName('__')).toBe(false)
    })

    it('rejects invalid channel names', () => {
      expect(isNonReservedChannelName('')).toBe(false)
    })
  })

  describe('assertValidChannelName', () => {
    it('does not throw for valid channel names', () => {
      expect(() => assertValidChannelName('chat')).not.toThrow()
      expect(() => assertValidChannelName('user-123')).not.toThrow()
    })

    it('throws for invalid channel names', () => {
      expect(() => assertValidChannelName('')).toThrow()
      expect(() => assertValidChannelName('x'.repeat(129))).toThrow()
    })

    it('throws for reserved channel names', () => {
      expect(() => assertValidChannelName('__system')).toThrow(
        'Reserved channel name',
      )
      expect(() => assertValidChannelName('__')).toThrow(
        'Reserved channel name',
      )
    })
  })
})
