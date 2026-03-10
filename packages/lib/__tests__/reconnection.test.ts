/**
 * Reconnection utilities tests
 */

import { describe, it, expect } from 'vitest'
import {
    calculateBackoff,
    calculateBackoffWithJitter,
    shouldReconnect,
    createInitialReconnectionState,
    advanceReconnectionState,
    resetReconnectionState,
    DEFAULT_RECONNECT_DELAY,
    DEFAULT_MAX_RECONNECT_DELAY,
    DEFAULT_BACKOFF_MULTIPLIER,
} from '../reconnection.js'

describe('reconnection', () => {
    describe('calculateBackoff', () => {
        it('returns initial delay for first attempt', () => {
            const delay = calculateBackoff(0, { jitterFactor: 0 })

            expect(delay).toBe(DEFAULT_RECONNECT_DELAY)
        })

        it('calculates exponential backoff', () => {
            const delay1 = calculateBackoff(1)
            const delay2 = calculateBackoff(2)

            expect(delay2).toBeGreaterThan(delay1)
        })

        it('respects maximum delay', () => {
            const delay = calculateBackoff(100)

            expect(delay).toBeLessThanOrEqual(DEFAULT_MAX_RECONNECT_DELAY)
        })

        it('applies jitter when enabled', () => {
            const delay1 = calculateBackoff(5, { jitterFactor: 0.5 })
            const delay2 = calculateBackoff(5, { jitterFactor: 0.5 })

            // Jitter should produce different values
            expect(delay1).not.toBe(delay2)
        })

        it('respects custom options', () => {
            const delay = calculateBackoff(2, {
                initialDelay: 500,
                maxDelay: 1000,
                multiplier: 2,
            })

            expect(delay).toBeGreaterThan(0)
            expect(delay).toBeLessThanOrEqual(1000)
        })
    })

    describe('calculateBackoffWithJitter', () => {
        it('produces consistent results with same seed', () => {
            const delay1 = calculateBackoffWithJitter(3, 42, {
                jitterFactor: 0.5,
            })
            const delay2 = calculateBackoffWithJitter(3, 42, {
                jitterFactor: 0.5,
            })

            expect(delay1).toBe(delay2)
        })

        it('produces different results with different seeds', () => {
            const delay1 = calculateBackoffWithJitter(3, 42, {
                jitterFactor: 0.5,
            })
            const delay2 = calculateBackoffWithJitter(3, 99, {
                jitterFactor: 0.5,
            })

            expect(delay1).not.toBe(delay2)
        })
    })

    describe('shouldReconnect', () => {
        it('returns true when attempts below maximum', () => {
            expect(shouldReconnect(0, 10)).toBe(true)
            expect(shouldReconnect(5, 10)).toBe(true)
            expect(shouldReconnect(9, 10)).toBe(true)
        })

        it('returns false when attempts at or above maximum', () => {
            expect(shouldReconnect(10, 10)).toBe(false)
            expect(shouldReconnect(11, 10)).toBe(false)
        })

        it('always returns true when maxAttempts is Infinity', () => {
            expect(shouldReconnect(0, Infinity)).toBe(true)
            expect(shouldReconnect(100, Infinity)).toBe(true)
            expect(shouldReconnect(9999, Infinity)).toBe(true)
        })
    })

    describe('ReconnectionState', () => {
        it('creates initial state', () => {
            const state = createInitialReconnectionState()

            expect(state.attempts).toBe(0)
            expect(state.currentDelay).toBe(DEFAULT_RECONNECT_DELAY)
            expect(state.enabled).toBe(true)
        })

        it('creates initial disabled state', () => {
            const state = createInitialReconnectionState(false)

            expect(state.enabled).toBe(false)
        })

        it('advances reconnection state', () => {
            const initialState = createInitialReconnectionState()
            const nextState = advanceReconnectionState(initialState)

            expect(nextState.attempts).toBe(1)
            expect(nextState.currentDelay).toBeGreaterThan(
                initialState.currentDelay,
            )
            expect(nextState.enabled).toBe(initialState.enabled)
        })

        it('resets reconnection state', () => {
            const state = advanceReconnectionState(
                advanceReconnectionState(createInitialReconnectionState()),
            )
            const resetState = resetReconnectionState(state)

            expect(resetState.attempts).toBe(0)
            expect(resetState.currentDelay).toBe(DEFAULT_RECONNECT_DELAY)
            expect(resetState.enabled).toBe(state.enabled)
        })
    })
})
