import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Channel } from '../src/channel'
import { ClientRegistry } from '../src/registry'
import { createMockClient } from './setup'

describe('Channel', () => {
    let registry: ClientRegistry

    beforeEach(() => {
        registry = new ClientRegistry()
    })

    describe('default options', () => {
        it('should create a subscriber-scoped, bidirectional channel by default', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            expect(channel.name).toBe('chat')
            expect(channel.flow).toBe('bidirectional')
        })

        it('should allow subscription', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client = createMockClient('client-1')
            registry.register(client)

            expect(channel.subscribe('client-1')).toBe(true)
            expect(channel.hasSubscriber('client-1')).toBe(true)
        })

        it('should allow message handlers', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const handler = vi.fn()
            channel.onMessage(handler)

            expect(handler).not.toHaveBeenCalled()
        })
    })

    describe('flow: send-only', () => {
        it('should create a send-only channel', () => {
            const channel = new Channel({
                name: 'updates',
                registry,
                options: { flow: 'send-only' },
            })

            expect(channel.flow).toBe('send-only')
        })

        it('should throw when adding message handler to send-only channel', () => {
            const channel = new Channel({
                name: 'updates',
                registry,
                options: { flow: 'send-only' },
            })

            expect(() => channel.onMessage(vi.fn())).toThrow(
                /onMessage is not available in send-only mode/,
            )
        })

        it('should not dispatch messages from clients in send-only mode', async () => {
            const channel = new Channel({
                name: 'updates',
                registry,
                options: { flow: 'send-only' },
            })

            const client = createMockClient('client-1')
            registry.register(client)
            channel.subscribe(client.id)

            const publishSpy = vi.spyOn(channel, 'publish')

            // Dispatch should not publish in send-only mode
            await channel.dispatch({ text: 'hello' }, client, {
                id: 'msg-1',
                type: 'data' as any,
                channel: 'updates',
                timestamp: Date.now(),
                data: { text: 'hello' },
            })

            expect(publishSpy).not.toHaveBeenCalled()
        })
    })

    describe('flow: receive-only', () => {
        it('should create a receive-only channel', () => {
            const channel = new Channel({
                name: 'ingestion',
                registry,
                options: { flow: 'receive-only' },
            })

            expect(channel.flow).toBe('receive-only')
        })

        it('should allow message handlers in receive-only mode', () => {
            const channel = new Channel({
                name: 'ingestion',
                registry,
                options: { flow: 'receive-only' },
            })

            expect(() => channel.onMessage(vi.fn())).not.toThrow()
        })
    })

    describe('middleware', () => {
        it('should allow adding middleware', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const middleware = vi.fn()
            channel.use(middleware)

            expect(channel.getMiddlewares()).toHaveLength(1)
        })
    })

    describe('publishing', () => {
        it('should publish to subscribers in subscriber scope', () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client1 = createMockClient('client-1')
            const client2 = createMockClient('client-2')
            registry.register(client1)
            registry.register(client2)

            channel.subscribe('client-1')
            channel.subscribe('client-2')

            // Only subscribers should be counted
            expect(channel.subscriberCount).toBe(2)
        })
    })

    describe('message dispatch', () => {
        it('should auto-relay when no handlers are registered (bidirectional)', async () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client1 = createMockClient('client-1')
            const client2 = createMockClient('client-2')
            registry.register(client1)
            registry.register(client2)

            channel.subscribe('client-1')
            channel.subscribe('client-2')

            const client2Socket = client2.socket as any
            const sendSpy = vi.spyOn(client2Socket, 'send')

            await channel.dispatch({ text: 'hello' }, client1, {
                id: 'msg-1',
                type: 'data' as any,
                channel: 'chat',
                timestamp: Date.now(),
                data: { text: 'hello' },
            })

            // Should publish to client2
            expect(sendSpy).toHaveBeenCalled()
            const message = JSON.parse(sendSpy.mock.calls[0][0] as string)
            expect(message.channel).toBe('chat')
            expect(message.data.text).toBe('hello')
        })

        it('should call handlers when registered (bidirectional)', async () => {
            const channel = new Channel({
                name: 'chat',
                registry,
            })

            const client = createMockClient('client-1')
            registry.register(client)
            channel.subscribe(client.id)

            const handler = vi.fn()
            channel.onMessage(handler)

            await channel.dispatch({ text: 'hello' }, client, {
                id: 'msg-1',
                type: 'data' as any,
                channel: 'chat',
                timestamp: Date.now(),
                data: { text: 'hello' },
            })

            expect(handler).toHaveBeenCalledWith(
                { text: 'hello' },
                client,
                expect.objectContaining({ id: 'msg-1' }),
            )
        })
    })
})
