/**
 * Errors Tests
 */

import { describe, it, expect } from 'vitest'
import {
  SynnelError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from '../src/errors/index.js'

describe('Errors', () => {
  describe('SynnelError', () => {
    it('should create a base SynnelError', () => {
      const error = new SynnelError('Test error', 'TEST_CODE')

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.name).toBe('SynnelError')
    })

    it('should have undefined context by default', () => {
      const error = new SynnelError('Test', 'TEST')

      expect(error.context).toBeUndefined()
    })

    it('should accept context object', () => {
      const context = { key: 'value', number: 42 }
      const error = new SynnelError('Test', 'TEST', context)

      expect(error.context).toEqual(context)
    })

    it('should convert to JSON correctly', () => {
      const error = new SynnelError('Test error', 'TEST_CODE', { key: 'value' })
      const json = error.toJSON()

      expect(json.name).toBe('SynnelError')
      expect(json.message).toBe('Test error')
      expect(json.code).toBe('TEST_CODE')
      expect(json.context).toEqual({ key: 'value' })
      expect(json.stack).toBeDefined()
    })

    it('should convert to string correctly', () => {
      const error = new SynnelError('Test error', 'TEST_CODE')
      const str = error.toString()

      expect(str).toContain('Test error')
      expect(str).toContain('TEST_CODE')
    })
  })

  describe('ConfigError', () => {
    it('should create ConfigError extending SynnelError', () => {
      const error = new ConfigError('Invalid config')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(ConfigError)
      expect(error.name).toBe('ConfigError')
    })

    it('should have default code CONFIG_ERROR', () => {
      const error = new ConfigError('Test')
      expect(error.code).toBe('CONFIG_ERROR')
    })
  })

  describe('TransportError', () => {
    it('should create TransportError extending SynnelError', () => {
      const error = new TransportError('Transport failed')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(TransportError)
      expect(error.name).toBe('TransportError')
    })

    it('should have default code TRANSPORT_ERROR', () => {
      const error = new TransportError('Test')
      expect(error.code).toBe('TRANSPORT_ERROR')
    })
  })

  describe('ChannelError', () => {
    it('should create ChannelError extending SynnelError', () => {
      const error = new ChannelError('Channel not found')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(ChannelError)
      expect(error.name).toBe('ChannelError')
    })

    it('should have default code CHANNEL_ERROR', () => {
      const error = new ChannelError('Test')
      expect(error.code).toBe('CHANNEL_ERROR')
    })
  })

  describe('ClientError', () => {
    it('should create ClientError extending SynnelError', () => {
      const error = new ClientError('Client not found')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(ClientError)
      expect(error.name).toBe('ClientError')
    })

    it('should have default code CLIENT_ERROR', () => {
      const error = new ClientError('Test')
      expect(error.code).toBe('CLIENT_ERROR')
    })
  })

  describe('MessageError', () => {
    it('should create MessageError extending SynnelError', () => {
      const error = new MessageError('Invalid message')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(MessageError)
      expect(error.name).toBe('MessageError')
    })

    it('should have default code MESSAGE_ERROR', () => {
      const error = new MessageError('Test')
      expect(error.code).toBe('MESSAGE_ERROR')
    })
  })

  describe('ValidationError', () => {
    it('should create ValidationError extending SynnelError', () => {
      const error = new ValidationError('Validation failed')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.name).toBe('ValidationError')
    })

    it('should have default code VALIDATION_ERROR', () => {
      const error = new ValidationError('Test')
      expect(error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('StateError', () => {
    it('should create StateError extending SynnelError', () => {
      const error = new StateError('Invalid state')

      expect(error).toBeInstanceOf(SynnelError)
      expect(error).toBeInstanceOf(StateError)
      expect(error.name).toBe('StateError')
    })

    it('should have default code STATE_ERROR', () => {
      const error = new StateError('Test')
      expect(error.code).toBe('STATE_ERROR')
    })
  })

  describe('MiddlewareRejectionError', () => {
    it('should create MiddlewareRejectionError with reason and action', () => {
      const error = new MiddlewareRejectionError('Not allowed', 'connect')

      expect(error.reason).toBe('Not allowed')
      expect(error.action).toBe('connect')
    })

    it('should have name MiddlewareRejectionError', () => {
      const error = new MiddlewareRejectionError('Not allowed', 'connect')
      expect(error.name).toBe('MiddlewareRejectionError')
    })

    it('should create error message with reason and action', () => {
      const error = new MiddlewareRejectionError('Not allowed', 'connect')
      expect(error.message).toContain('connect')
      expect(error.message).toContain('Not allowed')
    })

    it('should be instanceof Error', () => {
      const error = new MiddlewareRejectionError('Not allowed', 'connect')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('MiddlewareExecutionError', () => {
    it('should create MiddlewareExecutionError with action, middleware, and cause', () => {
      const originalError = new Error('Original error')
      const error = new MiddlewareExecutionError('connect', 'auth', originalError)

      expect(error.action).toBe('connect')
      expect(error.middleware).toBe('auth')
      expect(error.cause).toBe(originalError)
      expect(error.name).toBe('MiddlewareExecutionError')
    })

    it('should have informative error message', () => {
      const originalError = new Error('Invalid token')
      const error = new MiddlewareExecutionError('connect', 'auth', originalError)

      expect(error.message).toContain('auth')
      expect(error.message).toContain('connect')
      expect(error.message).toContain('Invalid token')
    })

    it('should be instanceof Error', () => {
      const originalError = new Error('Test')
      const error = new MiddlewareExecutionError('connect', 'test', originalError)
      expect(error).toBeInstanceOf(Error)
    })

    it('should provide getCause() method', () => {
      const originalError = new Error('Original')
      const error = new MiddlewareExecutionError('message', 'test', originalError)

      expect(error.getCause()).toBe(originalError)
    })
  })

  describe('instanceof checks', () => {
    it('should identify ConfigError correctly', () => {
      const error = new ConfigError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof ConfigError).toBe(true)
    })

    it('should identify TransportError correctly', () => {
      const error = new TransportError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof TransportError).toBe(true)
    })

    it('should identify ChannelError correctly', () => {
      const error = new ChannelError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof ChannelError).toBe(true)
    })

    it('should identify ClientError correctly', () => {
      const error = new ClientError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof ClientError).toBe(true)
    })

    it('should identify MessageError correctly', () => {
      const error = new MessageError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof MessageError).toBe(true)
    })

    it('should identify ValidationError correctly', () => {
      const error = new ValidationError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof ValidationError).toBe(true)
    })

    it('should identify StateError correctly', () => {
      const error = new StateError('Test')
      expect(error instanceof SynnelError).toBe(true)
      expect(error instanceof StateError).toBe(true)
    })

    it('should identify MiddlewareRejectionError correctly', () => {
      const error = new MiddlewareRejectionError('Test', 'test')
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('MiddlewareRejectionError')
    })

    it('should identify MiddlewareExecutionError correctly', () => {
      const originalError = new Error('Test')
      const error = new MiddlewareExecutionError('connect', 'auth', originalError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('MiddlewareExecutionError')
    })
  })

  describe('error message format', () => {
    it('should format SynnelError correctly', () => {
      const error = new SynnelError('Something failed', 'ERR_001')
      expect(error.toString()).toMatch(/SynnelError/)
      expect(error.toString()).toMatch(/Something failed/)
      expect(error.toString()).toMatch(/ERR_001/)
    })

    it('should format ConfigError correctly', () => {
      const error = new ConfigError('Bad config')
      expect(error.toString()).toMatch(/ConfigError/)
      expect(error.toString()).toMatch(/Bad config/)
    })

    it('should format ChannelError correctly', () => {
      const error = new ChannelError('Channel not found: test')
      expect(error.toString()).toMatch(/ChannelError/)
      expect(error.toString()).toMatch(/Channel not found: test/)
    })

    it('should format MiddlewareRejectionError correctly', () => {
      const error = new MiddlewareRejectionError('Unauthorized', 'message')
      expect(error.toString()).toMatch(/MiddlewareRejectionError/)
      expect(error.toString()).toMatch(/Unauthorized/)
      expect(error.toString()).toMatch(/message/)
    })
  })
})
