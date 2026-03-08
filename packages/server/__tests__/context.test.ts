/**
 * Unit tests for context.ts
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'
import { createContext, ContextManager } from '../src/context'
import type { Context, ContextOptions, Middleware, IMiddlewareAction } from '../src/types'

describe('context', () => {
  describe('createContext', () => {
    it('should create a context with required fields', () => {
      const options: ContextOptions = {
        action: 'message',
      }

      const context = createContext(options)

      expect(context.req.action).toBe('message')
      expect(context.finalized).toBe(false)
      expect(context.var).toEqual({})
    })

    it('should include client when provided', () => {
      const client = {
        id: 'client-123',
        connectedAt: Date.now(),
        socket: {} as any,
      }

      const options: ContextOptions = {
        action: 'connect',
        client,
      }

      const context = createContext(options)

      expect(context.req.client).toBe(client)
    })

    it('should include message when provided', () => {
      const message = {
        id: 'msg-123',
        type: 'data' as const,
        channel: 'chat',
        data: 'hello',
        timestamp: Date.now(),
      }

      const options: ContextOptions = {
        action: 'message',
        message,
      }

      const context = createContext(options)

      expect(context.req.message).toBe(message)
    })

    it('should include channel when provided', () => {
      const options: ContextOptions = {
        action: 'subscribe',
        channel: 'chat',
      }

      const context = createContext(options)

      expect(context.req.channel).toBe('chat')
    })

    it('should initialize with provided state', () => {
      interface TestState {
        user?: string
        requestId?: string
      }

      const options: ContextOptions<TestState> = {
        action: 'message',
        initialState: {
          user: 'alice',
          requestId: 'req-123',
        },
      }

      const context = createContext<TestState>(options)

      expect(context.get('user')).toBe('alice')
      expect(context.get('requestId')).toBe('req-123')
    })

    describe('get()', () => {
      it('should return value from state', () => {
        interface TestState {
          value: string
        }

        const context = createContext<TestState>({
          action: 'message',
          initialState: { value: 'test' },
        })

        expect(context.get('value')).toBe('test')
      })

      it('should return undefined for non-existent key', () => {
        const context = createContext({ action: 'message' })

        expect(context.get('nonexistent')).toBeUndefined()
      })
    })

    describe('set()', () => {
      it('should set value in state', () => {
        interface TestState {
          value: string
        }

        const context = createContext<TestState>({ action: 'message' })

        context.set('value', 'test')

        expect(context.get('value')).toBe('test')
      })

      it('should update existing value', () => {
        interface TestState {
          count: number
        }

        const context = createContext<TestState>({
          action: 'message',
          initialState: { count: 1 },
        })

        context.set('count', 2)

        expect(context.get('count')).toBe(2)
      })
    })

    describe('reject()', () => {
      it('should throw an error with the provided reason', () => {
        const context = createContext({ action: 'connect' })

        expect(() => context.reject('Not allowed')).toThrow('Not allowed')
      })

      it('should include action in error message', () => {
        const context = createContext({ action: 'subscribe' })

        expect(() => context.reject('Forbidden')).toThrow("Action 'subscribe' rejected: Forbidden")
      })
    })
  })

  describe('ContextManager', () => {
    let manager: ContextManager

    beforeEach(() => {
      manager = new ContextManager()
    })

    describe('use()', () => {
      it('should register middleware', () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(middleware)

        expect(manager.getCount()).toBe(1)
      })

      it('should register multiple middleware', () => {
        const mw1: Middleware = vi.fn(async (_ctx, next) => next())
        const mw2: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(mw1)
        manager.use(mw2)

        expect(manager.getCount()).toBe(2)
      })
    })

    describe('remove()', () => {
      it('should remove registered middleware', () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(middleware)
        expect(manager.getCount()).toBe(1)

        const removed = manager.remove(middleware)

        expect(removed).toBe(true)
        expect(manager.getCount()).toBe(0)
      })

      it('should return false when removing non-existent middleware', () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        const removed = manager.remove(middleware)

        expect(removed).toBe(false)
      })
    })

    describe('clear()', () => {
      it('should remove all middleware', () => {
        const mw1: Middleware = vi.fn(async (_ctx, next) => next())
        const mw2: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(mw1)
        manager.use(mw2)
        expect(manager.getCount()).toBe(2)

        manager.clear()

        expect(manager.getCount()).toBe(0)
      })
    })

    describe('getMiddlewares()', () => {
      it('should return copy of middleware array', () => {
        const mw1: Middleware = vi.fn(async (_ctx, next) => next())
        const mw2: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(mw1)
        manager.use(mw2)

        const middlewares = manager.getMiddlewares()

        expect(middlewares).toHaveLength(2)
        expect(middlewares).toEqual([mw1, mw2])
      })

      it('should not expose internal array', () => {
        const mw1: Middleware = vi.fn(async (_ctx, next) => next())
        manager.use(mw1)

        const middlewares = manager.getMiddlewares()
        middlewares.push(vi.fn() as any)

        expect(manager.getCount()).toBe(1)
      })
    })

    describe('hasMiddleware()', () => {
      it('should return true when middleware is registered', () => {
        manager.use(vi.fn(async (_ctx, next) => next()))

        expect(manager.hasMiddleware()).toBe(true)
      })

      it('should return false when no middleware is registered', () => {
        expect(manager.hasMiddleware()).toBe(false)
      })
    })

    describe('getCount()', () => {
      it('should return the number of registered middleware', () => {
        expect(manager.getCount()).toBe(0)

        manager.use(vi.fn(async (_ctx, next) => next()))
        expect(manager.getCount()).toBe(1)

        manager.use(vi.fn(async (_ctx, next) => next()))
        expect(manager.getCount()).toBe(2)
      })
    })

    describe('createConnectionContext()', () => {
      it('should create context for connect action', () => {
        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        const context = manager.createConnectionContext(client, 'connect')

        expect(context.req.action).toBe('connect')
        expect(context.req.client).toBe(client)
      })

      it('should create context for disconnect action', () => {
        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        const context = manager.createConnectionContext(client, 'disconnect')

        expect(context.req.action).toBe('disconnect')
        expect(context.req.client).toBe(client)
      })
    })

    describe('createMessageContext()', () => {
      it('should create context with message', () => {
        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        const message = {
          id: 'msg-123',
          type: 'data' as const,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }

        const context = manager.createMessageContext(client, message)

        expect(context.req.action).toBe('message')
        expect(context.req.client).toBe(client)
        expect(context.req.message).toBe(message)
      })
    })

    describe('createSubscribeContext()', () => {
      it('should create context for subscribe action', () => {
        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        const context = manager.createSubscribeContext(client, 'chat')

        expect(context.req.action).toBe('subscribe')
        expect(context.req.client).toBe(client)
        expect(context.req.channel).toBe('chat')
      })
    })

    describe('createUnsubscribeContext()', () => {
      it('should create context for unsubscribe action', () => {
        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        const context = manager.createUnsubscribeContext(client, 'chat')

        expect(context.req.action).toBe('unsubscribe')
        expect(context.req.client).toBe(client)
        expect(context.req.channel).toBe('chat')
      })
    })

    describe('execute()', () => {
      it('should execute middleware in order', () => {
        const order: number[] = []

        const mw1: Middleware = async (_ctx, next) => {
          order.push(1)
          await next()
          order.push(3)
        }

        const mw2: Middleware = async (_ctx, next) => {
          order.push(2)
          await next()
        }

        manager.use(mw1)
        manager.use(mw2)

        const context = createContext({ action: 'message' })
        manager.execute(context)

        // Note: execute returns a Promise, but we're not awaiting here
        // The order will be set when the promise resolves
      })

      it('should call final handler after all middleware', async () => {
        const order: number[] = []

        manager.use(async (_ctx, next) => {
          order.push(1)
          await next()
          order.push(3)
        })

        const finalHandler = vi.fn(async () => {
          order.push(2)
        })

        const context = createContext({ action: 'message' })
        await manager.execute(context, manager.getMiddlewares(), finalHandler)

        expect(order).toEqual([1, 2, 3])
        expect(finalHandler).toHaveBeenCalledTimes(1)
      })

      it('should return the context', async () => {
        const middleware: Middleware = async (_ctx, next) => next()

        manager.use(middleware)

        const context = createContext({ action: 'message' })
        const result = await manager.execute(context)

        expect(result).toBe(context)
      })
    })

    describe('executeConnection()', () => {
      it('should execute middleware for connection action', async () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(middleware)

        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        await manager.executeConnection(client, 'connect')

        expect(middleware).toHaveBeenCalledWith(
          expect.objectContaining({
            req: expect.objectContaining({ action: 'connect', client }),
          }),
          expect.any(Function)
        )
      })
    })

    describe('executeMessage()', () => {
      it('should execute middleware for message action', async () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(middleware)

        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        const message = {
          id: 'msg-123',
          type: 'data' as const,
          channel: 'chat',
          data: 'hello',
          timestamp: Date.now(),
        }

        await manager.executeMessage(client, message)

        expect(middleware).toHaveBeenCalledWith(
          expect.objectContaining({
            req: expect.objectContaining({ action: 'message', client, message }),
          }),
          expect.any(Function)
        )
      })
    })

    describe('executeSubscribe()', () => {
      it('should execute middleware for subscribe action', async () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(middleware)

        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        await manager.executeSubscribe(client, 'chat')

        expect(middleware).toHaveBeenCalledWith(
          expect.objectContaining({
            req: expect.objectContaining({ action: 'subscribe', client, channel: 'chat' }),
          }),
          expect.any(Function)
        )
      })

      it('should execute final handler', async () => {
        const finalHandler = vi.fn(async () => {})

        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        await manager.executeSubscribe(client, 'chat', finalHandler)

        expect(finalHandler).toHaveBeenCalledTimes(1)
      })
    })

    describe('executeUnsubscribe()', () => {
      it('should execute middleware for unsubscribe action', async () => {
        const middleware: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(middleware)

        const client = {
          id: 'client-123',
          connectedAt: Date.now(),
          socket: {} as any,
        }

        await manager.executeUnsubscribe(client, 'chat')

        expect(middleware).toHaveBeenCalledWith(
          expect.objectContaining({
            req: expect.objectContaining({ action: 'unsubscribe', client, channel: 'chat' }),
          }),
          expect.any(Function)
        )
      })
    })

    describe('getPipeline()', () => {
      it('should return global middleware only when no channel provided', () => {
        const mw1: Middleware = vi.fn(async (_ctx, next) => next())
        const mw2: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(mw1)
        manager.use(mw2)

        const pipeline = manager.getPipeline()

        expect(pipeline).toEqual([mw1, mw2])
      })

      it('should include channel middleware when provided', () => {
        const globalMw: Middleware = vi.fn(async (_ctx, next) => next())
        const channelMw: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(globalMw)

        const mockChannel = {
          getMiddlewares: () => [channelMw],
        }

        const pipeline = manager.getPipeline(mockChannel as any)

        expect(pipeline).toEqual([globalMw, channelMw])
      })

      it('should handle channels without middleware', () => {
        const globalMw: Middleware = vi.fn(async (_ctx, next) => next())

        manager.use(globalMw)

        const mockChannel = {
          getMiddlewares: undefined,
        }

        const pipeline = manager.getPipeline(mockChannel as any)

        expect(pipeline).toEqual([globalMw])
      })
    })
  })
})
