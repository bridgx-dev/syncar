/**
 * Unit tests for errors.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  SyncarError,
  ConfigError,
  TransportError,
  ChannelError,
  ClientError,
  MessageError,
  ValidationError,
  StateError,
  MiddlewareRejectionError,
  MiddlewareExecutionError,
} from '../src/errors'

describe('SyncarError', () => {
  describe('constructor', () => {
    it('should create error with message and default code', () => {
      const error = new SyncarError('Something went wrong')

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Something went wrong')
      expect(error.code).toBe('SYNNEL_ERROR')
      expect(error.name).toBe('SyncarError')
    })

    it('should create error with custom code', () => {
      const error = new SyncarError('Failed', 'CUSTOM_ERROR')

      expect(error.code).toBe('CUSTOM_ERROR')
    })

    it('should accept context object', () => {
      const context = { userId: '123', requestId: 'abc' }
      const error = new SyncarError('Failed', 'FAILED', context)

      expect(error.context).toEqual(context)
    })

    it('should have proper stack trace', () => {
      const error = new SyncarError('Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('SyncarError')
    })
  })

  describe('toJSON()', () => {
    it('should serialize error to JSON', () => {
      const error = new SyncarError('Test error', 'TEST', { key: 'value' })
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'SyncarError',
        message: 'Test error',
        code: 'TEST',
        context: { key: 'value' },
        stack: error.stack,
      })
    })

    it('should handle error without context', () => {
      const error = new SyncarError('Test error')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'SyncarError',
        message: 'Test error',
        code: 'SYNNEL_ERROR',
        stack: error.stack,
      })
    })
  })

  describe('toString()', () => {
    it('should format error as string', () => {
      const error = new SyncarError('Test error', 'TEST')

      expect(error.toString()).toBe('[SyncarError:TEST] Test error')
    })
  })
})

describe('ConfigError', () => {
  it('should create error with correct code and name', () => {
    const error = new ConfigError('Invalid port')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('ConfigError')
    expect(error.code).toBe('CONFIG_ERROR')
    expect(error.message).toBe('Invalid port')
  })

  it('should accept context', () => {
    const error = new ConfigError('Invalid port', { port: 'abc' })

    expect(error.context).toEqual({ port: 'abc' })
  })

  it('should serialize correctly', () => {
    const error = new ConfigError('Invalid config')
    const json = error.toJSON()

    expect(json.name).toBe('ConfigError')
    expect(json.code).toBe('CONFIG_ERROR')
  })
})

describe('TransportError', () => {
  it('should create error with correct code and name', () => {
    const error = new TransportError('WebSocket error')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('TransportError')
    expect(error.code).toBe('TRANSPORT_ERROR')
  })

  it('should accept context', () => {
    const error = new TransportError('Connection failed', { url: 'ws://localhost' })

    expect(error.context).toEqual({ url: 'ws://localhost' })
  })
})

describe('ChannelError', () => {
  it('should create error with correct code and name', () => {
    const error = new ChannelError('Channel not found')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('ChannelError')
    expect(error.code).toBe('CHANNEL_ERROR')
  })
})

describe('ClientError', () => {
  it('should create error with correct code and name', () => {
    const error = new ClientError('Client not found')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('ClientError')
    expect(error.code).toBe('CLIENT_ERROR')
  })
})

describe('MessageError', () => {
  it('should create error with correct code and name', () => {
    const error = new MessageError('Invalid message')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('MessageError')
    expect(error.code).toBe('MESSAGE_ERROR')
  })
})

describe('ValidationError', () => {
  it('should create error with correct code and name', () => {
    const error = new ValidationError('Invalid input')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('ValidationError')
    expect(error.code).toBe('VALIDATION_ERROR')
  })
})

describe('StateError', () => {
  it('should create error with correct code and name', () => {
    const error = new StateError('Invalid state')

    expect(error).toBeInstanceOf(SyncarError)
    expect(error.name).toBe('StateError')
    expect(error.code).toBe('STATE_ERROR')
  })
})

describe('MiddlewareRejectionError', () => {
  describe('constructor', () => {
    it('should create error with reason and action', () => {
      const error = new MiddlewareRejectionError('Not authorized', 'subscribe')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('MiddlewareRejectionError')
      expect(error.reason).toBe('Not authorized')
      expect(error.action).toBe('subscribe')
      expect(error.message).toBe("Action 'subscribe' rejected: Not authorized")
    })

    it('should accept string action', () => {
      const error = new MiddlewareRejectionError('Failed', 'custom-action')

      expect(error.action).toBe('custom-action')
    })

    it('should accept error code', () => {
      const error = new MiddlewareRejectionError('Not allowed', 'connect', 'FORBIDDEN')

      expect(error.code).toBe('FORBIDDEN')
    })

    it('should accept context', () => {
      const context = { userId: '123' }
      const error = new MiddlewareRejectionError('Not allowed', 'connect', 'FORBIDDEN', context)

      expect(error.context).toEqual(context)
    })

    it('should have proper stack trace', () => {
      const error = new MiddlewareRejectionError('Rejected', 'message')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('MiddlewareRejectionError')
    })
  })

  describe('toJSON()', () => {
    it('should serialize error to JSON', () => {
      const error = new MiddlewareRejectionError(
        'Not allowed',
        'subscribe',
        'FORBIDDEN',
        { userId: '123' }
      )
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'MiddlewareRejectionError',
        reason: 'Not allowed',
        action: 'subscribe',
        code: 'FORBIDDEN',
        context: { userId: '123' },
        message: "Action 'subscribe' rejected: Not allowed",
        stack: error.stack,
      })
    })

    it('should handle error without optional fields', () => {
      const error = new MiddlewareRejectionError('Rejected', 'message')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'MiddlewareRejectionError',
        reason: 'Rejected',
        action: 'message',
        message: "Action 'message' rejected: Rejected",
        stack: error.stack,
      })
    })
  })

  describe('toString()', () => {
    it('should format error as string', () => {
      const error = new MiddlewareRejectionError('Not allowed', 'subscribe', 'FORBIDDEN')

      expect(error.toString()).toBe('[MiddlewareRejectionError:subscribe] Not allowed')
    })
  })
})

describe('MiddlewareExecutionError', () => {
  const originalError = new Error('Database connection failed')

  describe('constructor', () => {
    it('should create error with action and middleware name', () => {
      const error = new MiddlewareExecutionError('message', 'auth-middleware', originalError)

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('MiddlewareExecutionError')
      expect(error.action).toBe('message')
      expect(error.middleware).toBe('auth-middleware')
      expect(error.cause).toBe(originalError)
    })

    it('should generate descriptive message', () => {
      const error = new MiddlewareExecutionError('connect', 'auth-middleware', originalError)

      expect(error.message).toBe('Middleware execution error in auth-middleware during connect: Database connection failed')
    })

    it('should have proper stack trace', () => {
      const error = new MiddlewareExecutionError('message', 'auth', originalError)

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('MiddlewareExecutionError')
    })
  })

  describe('getCause()', () => {
    it('should return the original error', () => {
      const error = new MiddlewareExecutionError('message', 'auth', originalError)
      const cause = error.getCause()

      expect(cause).toBe(originalError)
      expect(cause.message).toBe('Database connection failed')
    })
  })

  describe('toString()', () => {
    it('should format error as string', () => {
      const error = new MiddlewareExecutionError('subscribe', 'auth-check', originalError)

      expect(error.toString()).toBe('[MiddlewareExecutionError] auth-check failed during subscribe: Database connection failed')
    })
  })

  describe('cause property', () => {
    it('should expose cause as readonly property', () => {
      const error = new MiddlewareExecutionError('message', 'auth', originalError)

      expect(error.cause).toBe(originalError)
    })
  })
})

describe('Error inheritance chain', () => {
  it('should maintain instanceof checks', () => {
    const syncarError = new SyncarError('Test')
    const configError = new ConfigError('Test')
    const rejectionError = new MiddlewareRejectionError('Test', 'test')
    const executionError = new MiddlewareExecutionError('test', 'test', new Error('cause'))

    expect(syncarError).toBeInstanceOf(Error)
    expect(syncarError).toBeInstanceOf(SyncarError)

    expect(configError).toBeInstanceOf(Error)
    expect(configError).toBeInstanceOf(SyncarError)
    expect(configError).toBeInstanceOf(ConfigError)

    expect(rejectionError).toBeInstanceOf(Error)
    expect(rejectionError).toBeInstanceOf(MiddlewareRejectionError)

    expect(executionError).toBeInstanceOf(Error)
    expect(executionError).toBeInstanceOf(MiddlewareExecutionError)
  })
})

describe('Error context edge cases', () => {
  it('should handle empty context', () => {
    const error = new SyncarError('Test', 'TEST', {})

    expect(error.context).toEqual({})
  })

  it('should handle undefined context', () => {
    const error = new SyncarError('Test', 'TEST', undefined)

    expect(error.context).toBeUndefined()
  })

  it('should handle complex nested context', () => {
    const context = {
      user: { id: '123', name: 'Test' },
      metadata: { key: 'value', nested: { deep: 'value' } },
    }
    const error = new SyncarError('Test', 'TEST', context)

    expect(error.context).toEqual(context)
  })
})

describe('Error serialization edge cases', () => {
  it('should handle error without stack trace', () => {
    const error = new SyncarError('Test')
    const stack = error.stack
    error.stack = undefined

    const json = error.toJSON()
    expect(json.stack).toBeUndefined()

    // Restore for cleanup
    error.stack = stack
  })

  it('should handle toJSON() for all error types', () => {
    const errors = [
      new ConfigError('Test'),
      new TransportError('Test'),
      new ChannelError('Test'),
      new ClientError('Test'),
      new MessageError('Test'),
      new ValidationError('Test'),
      new StateError('Test'),
    ]

    errors.forEach(error => {
      const json = error.toJSON()
      expect(json).toHaveProperty('name')
      expect(json).toHaveProperty('message')
      expect(json).toHaveProperty('code')
    })
  })
})
