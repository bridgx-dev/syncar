/**
 * Unit tests for config.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
    CLOSE_CODES,
    ERROR_CODES,
    DEFAULT_WS_PATH,
    DEFAULT_MAX_PAYLOAD,
    DEFAULT_PING_INTERVAL,
    DEFAULT_PING_TIMEOUT,
    DEFAULT_PORT,
    DEFAULT_HOST,
    DEFAULT_PATH,
    DEFAULT_ENABLE_PING,
    DEFAULT_SERVER_CONFIG,
    DEFAULT_RATE_LIMIT,
    DEFAULTS,
    type CloseCode,
    type ErrorCode,
} from '../src/config'

describe('config', () => {


    describe('CLOSE_CODES', () => {
        it('should contain all standard WebSocket close codes', () => {
            expect(CLOSE_CODES.NORMAL).toBe(1000)
            expect(CLOSE_CODES.GOING_AWAY).toBe(1001)
            expect(CLOSE_CODES.PROTOCOL_ERROR).toBe(1002)
            expect(CLOSE_CODES.UNSUPPORTED_DATA).toBe(1003)
            expect(CLOSE_CODES.NO_STATUS).toBe(1005)
            expect(CLOSE_CODES.ABNORMAL).toBe(1006)
            expect(CLOSE_CODES.INVALID_PAYLOAD).toBe(1007)
            expect(CLOSE_CODES.POLICY_VIOLATION).toBe(1008)
            expect(CLOSE_CODES.MESSAGE_TOO_BIG).toBe(1009)
            expect(CLOSE_CODES.MISSING_EXTENSION).toBe(1010)
            expect(CLOSE_CODES.INTERNAL_ERROR).toBe(1011)
            expect(CLOSE_CODES.SERVICE_RESTART).toBe(1012)
            expect(CLOSE_CODES.TRY_AGAIN_LATER).toBe(1013)
        })

        it('should contain custom Syncar close codes', () => {
            expect(CLOSE_CODES.REJECTED).toBe(4001)
            expect(CLOSE_CODES.RATE_LIMITED).toBe(4002)
            expect(CLOSE_CODES.CHANNEL_NOT_FOUND).toBe(4003)
            expect(CLOSE_CODES.UNAUTHORIZED).toBe(4005)
        })

        it('should allow CloseCode type assignment', () => {
            const code: CloseCode = CLOSE_CODES.NORMAL
            expect(code).toBe(1000)
        })
    })

    describe('ERROR_CODES', () => {
        it('should contain all error codes', () => {
            expect(ERROR_CODES.REJECTED).toBe('REJECTED')
            expect(ERROR_CODES.MISSING_CHANNEL).toBe('MISSING_CHANNEL')
            expect(ERROR_CODES.SUBSCRIBE_REJECTED).toBe('SUBSCRIBE_REJECTED')
            expect(ERROR_CODES.UNSUBSCRIBE_REJECTED).toBe(
                'UNSUBSCRIBE_REJECTED',
            )
            expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
            expect(ERROR_CODES.AUTH_FAILED).toBe('AUTH_FAILED')
            expect(ERROR_CODES.NOT_AUTHORIZED).toBe('NOT_AUTHORIZED')
            expect(ERROR_CODES.CHANNEL_NOT_ALLOWED).toBe('CHANNEL_NOT_ALLOWED')
            expect(ERROR_CODES.INVALID_MESSAGE).toBe('INVALID_MESSAGE')
            expect(ERROR_CODES.SERVER_ERROR).toBe('SERVER_ERROR')
        })

        it('should allow ErrorCode type assignment', () => {
            const code: ErrorCode = ERROR_CODES.REJECTED
            expect(code).toBe('REJECTED')
        })
    })

    describe('Default WebSocket Settings', () => {
        it('should have correct default WebSocket path', () => {
            expect(DEFAULT_WS_PATH).toBe('/syncar')
        })

        it('should have correct default max payload (1MB)', () => {
            expect(DEFAULT_MAX_PAYLOAD).toBe(1048576)
        })

        it('should have correct default ping interval (30s)', () => {
            expect(DEFAULT_PING_INTERVAL).toBe(30000)
        })

        it('should have correct default ping timeout (5s)', () => {
            expect(DEFAULT_PING_TIMEOUT).toBe(5000)
        })
    })

    describe('Default Server Settings', () => {
        it('should have correct default port', () => {
            expect(DEFAULT_PORT).toBe(3000)
        })

        it('should have correct default host', () => {
            expect(DEFAULT_HOST).toBe('0.0.0.0')
        })

        it('should have correct default path', () => {
            expect(DEFAULT_PATH).toBe('/syncar')
        })

        it('should have ping enabled by default', () => {
            expect(DEFAULT_ENABLE_PING).toBe(true)
        })

        it('should have complete default server config', () => {
            expect(DEFAULT_SERVER_CONFIG).toEqual({
                port: 3000,
                host: '0.0.0.0',
                path: '/syncar',
                enablePing: true,
                pingInterval: 30000,
                pingTimeout: 5000,
                broadcastChunkSize: 500,
            })
        })
    })

    describe('Default Rate Limit Settings', () => {
        it('should have correct default max messages', () => {
            expect(DEFAULT_RATE_LIMIT.maxMessages).toBe(100)
        })

        it('should have correct default time window (1 minute)', () => {
            expect(DEFAULT_RATE_LIMIT.windowMs).toBe(60000)
        })
    })

    describe('DEFAULTS', () => {
        it('should contain all default configurations', () => {
            expect(DEFAULTS.server).toBe(DEFAULT_SERVER_CONFIG)
            expect(DEFAULTS.rateLimit).toBe(DEFAULT_RATE_LIMIT)
        })

        it('should have the correct structure', () => {
            expect(Object.keys(DEFAULTS)).toEqual(['server', 'rateLimit'])
        })
    })
})
