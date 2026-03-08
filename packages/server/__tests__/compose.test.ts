/**
 * Unit tests for compose.ts (middleware composition utility)
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'
import { compose } from '../src/compose'
import type { Context, Middleware } from '../src/types'

describe('compose', () => {
  const createMockContext = (): Context => ({
    req: {
      action: 'message',
    },
    finalized: false,
    var: {},
    get: vi.fn(),
    set: vi.fn(),
    reject: vi.fn(),
  })

  describe('basic middleware execution', () => {
    it('should execute single middleware', async () => {
      const middleware = vi.fn(async (_context: Context, next) => {
        await next()
      })
      const composed = compose([middleware])
      const context = createMockContext()

      await composed(context)

      expect(middleware).toHaveBeenCalledTimes(1)
    })

    it('should execute multiple middleware in order', async () => {
      const order: number[] = []

      const mw1: Middleware = async (context, next) => {
        order.push(1)
        await next()
        order.push(4)
      }

      const mw2: Middleware = async (context, next) => {
        order.push(2)
        await next()
        order.push(3)
      }

      const composed = compose([mw1, mw2])
      await composed(createMockContext())

      expect(order).toEqual([1, 2, 3, 4])
    })

    it('should pass context to all middleware', async () => {
      const context = createMockContext()
      const receivedContexts: Context[] = []

      const mw1: Middleware = async (ctx, next) => {
        receivedContexts.push(ctx)
        await next()
      }

      const mw2: Middleware = async (ctx, next) => {
        receivedContexts.push(ctx)
        await next()
      }

      const composed = compose([mw1, mw2])
      await composed(context)

      expect(receivedContexts).toHaveLength(2)
      expect(receivedContexts[0]).toBe(context)
      expect(receivedContexts[1]).toBe(context)
    })

    it('should return context from composed function', async () => {
      const context = createMockContext()
      const composed = compose([])
      const result = await composed(context)

      expect(result).toBe(context)
    })
  })

  describe('onion-style execution', () => {
    it('should execute middleware in onion pattern (last in, first out for post-processing)', async () => {
      const sequence: string[] = []

      const mw1: Middleware = async (_context, next) => {
        sequence.push('mw1-before')
        await next()
        sequence.push('mw1-after')
      }

      const mw2: Middleware = async (_context, next) => {
        sequence.push('mw2-before')
        await next()
        sequence.push('mw2-after')
      }

      const mw3: Middleware = async (_context, next) => {
        sequence.push('mw3-before')
        await next()
        sequence.push('mw3-after')
      }

      const composed = compose([mw1, mw2, mw3])
      await composed(createMockContext())

      expect(sequence).toEqual([
        'mw1-before',
        'mw2-before',
        'mw3-before',
        'mw3-after',
        'mw2-after',
        'mw1-after',
      ])
    })

    it('should allow early termination when next() is not called', async () => {
      const sequence: string[] = []

      const mw1: Middleware = async (_context, next) => {
        sequence.push('mw1-before')
        await next()
        sequence.push('mw1-after')
      }

      const mw2: Middleware = async (_context, _next) => {
        sequence.push('mw2-terminates')
        // Don't call next()
      }

      const mw3: Middleware = async () => {
        sequence.push('mw3-never-called')
      }

      const composed = compose([mw1, mw2, mw3])
      await composed(createMockContext())

      expect(sequence).toEqual(['mw1-before', 'mw2-terminates', 'mw1-after'])
      expect(sequence).not.toContain('mw3-never-called')
    })
  })

  describe('final handler', () => {
    it('should call final handler after all middleware', async () => {
      const order: number[] = []

      const mw1: Middleware = async (_context, next) => {
        order.push(1)
        await next()
        order.push(3)
      }

      const finalHandler = vi.fn(async () => {
        order.push(2)
      })

      const composed = compose([mw1])
      await composed(createMockContext(), finalHandler)

      expect(order).toEqual([1, 2, 3])
      expect(finalHandler).toHaveBeenCalledTimes(1)
    })

    it('should not call final handler if middleware chain terminates early', async () => {
      const finalHandler = vi.fn()

      const mw1: Middleware = async (_context, _next) => {
        // Don't call next()
      }

      const composed = compose([mw1])
      await composed(createMockContext(), finalHandler)

      expect(finalHandler).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should throw error when next() is called multiple times', async () => {
      let savedNext: (() => Promise<void>) | null = null

      const middleware: Middleware = async (_context, next) => {
        savedNext = next
        // First call
        await next()
      }

      const secondMiddleware: Middleware = async () => {
        // Call the saved next function again after first middleware completes
        if (savedNext) await savedNext()
      }

      const composed = compose([middleware, secondMiddleware])

      await expect(composed(createMockContext())).rejects.toThrow(
        'next() called multiple times'
      )
    })

    it('should propagate errors from middleware', async () => {
      const testError = new Error('Test error')

      const middleware: Middleware = async () => {
        throw testError
      }

      const composed = compose([middleware])

      await expect(composed(createMockContext())).rejects.toThrow('Test error')
    })

    it('should propagate errors from final handler', async () => {
      const testError = new Error('Final handler error')

      const middleware: Middleware = async (_context, next) => {
        await next()
      }

      const finalHandler = vi.fn(async () => {
        throw testError
      })

      const composed = compose([middleware])

      await expect(composed(createMockContext(), finalHandler)).rejects.toThrow('Final handler error')
    })
  })

  describe('response handling', () => {
    it('should set context.res when middleware returns a value', async () => {
      const context = createMockContext()
      const responseData = { success: true }

      const middleware: Middleware = async () => {
        return responseData
      }

      const composed = compose([middleware])
      await composed(context)

      expect(context.res).toEqual(responseData)
      expect(context.finalized).toBe(true)
    })

    it('should not overwrite already finalized context', async () => {
      const context = createMockContext()
      context.finalized = true
      context.res = 'first'

      const middleware: Middleware = async () => {
        return 'second'
      }

      const composed = compose([middleware])
      await composed(context)

      expect(context.res).toBe('first')
    })

    it('should handle undefined returns without finalizing', async () => {
      const context = createMockContext()

      const middleware: Middleware = async (_context, next) => {
        await next()
        return undefined // Explicitly return undefined
      }

      const composed = compose([middleware])
      await composed(context)

      expect(context.finalized).toBe(false)
      expect(context.res).toBeUndefined()
    })
  })

  describe('state management', () => {
    it('should allow middleware to share state via context.var', async () => {
      interface TestState {
        user?: string
        requestId?: string
      }

      const context: Context<TestState> = {
        req: { action: 'message' },
        finalized: false,
        var: {},
        get: vi.fn((key) => (context.var as any)[key]),
        set: vi.fn((key, value) => { (context.var as any)[key] = value }),
        reject: vi.fn(),
      }

      const mw1: Middleware<TestState> = async (ctx, next) => {
        ctx.set('requestId', 'req-123')
        await next()
      }

      const mw2: Middleware<TestState> = async (ctx, next) => {
        ctx.set('user', 'alice')
        await next()
      }

      const composed = compose([mw1, mw2])
      await composed(context)

      expect(context.set).toHaveBeenCalledWith('requestId', 'req-123')
      expect(context.set).toHaveBeenCalledWith('user', 'alice')
    })
  })

  describe('edge cases', () => {
    it('should handle empty middleware array', async () => {
      const context = createMockContext()
      const composed = compose([])

      const result = await composed(context)

      expect(result).toBe(context)
    })

    it('should handle async middleware', async () => {
      const order: number[] = []

      const asyncMw1: Middleware = async (_context, next) => {
        order.push(1)
        await new Promise(resolve => setTimeout(resolve, 10))
        await next()
        order.push(4)
      }

      const asyncMw2: Middleware = async (_context, next) => {
        order.push(2)
        await new Promise(resolve => setTimeout(resolve, 5))
        await next()
        order.push(3)
      }

      const composed = compose([asyncMw1, asyncMw2])
      await composed(createMockContext())

      expect(order).toEqual([1, 2, 3, 4])
    })
  })
})
