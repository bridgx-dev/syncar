/**
 * Unit tests for handlers
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConnectionHandler } from '../src/handlers/connections'
import { MessageHandler } from '../src/handlers/messages'
import { SignalHandler } from '../src/handlers/signal'
import { ClientRegistry } from '../src/registry'
import { ContextManager } from '../src/context'
import { Channel } from '../src/channel'
import {
    MessageType,
    SignalType,
    type IClientConnection,
    type DataMessage,
} from '../src/types'
import { ChannelError, MessageError } from '../src/errors'
import { CLOSE_CODES } from '../src/config'

// Mock WebSocket
class MockWebSocket {
    public readyState = 1 // OPEN
    public sent: string[] = []

    send(data: string, _callback?: () => void) {
        this.sent.push(data)
    }

    close(_code?: number, _reason?: string) {
        this.readyState = 3 // CLOSED
    }
}

describe('ConnectionHandler', () => {
    let registry: ClientRegistry
    let connectionHandler: ConnectionHandler

    beforeEach(() => {
        registry = new ClientRegistry()
        connectionHandler = new ConnectionHandler({
            registry,
        })
    })

    describe('constructor', () => {
        it('should create handler', () => {
            expect(connectionHandler).toBeInstanceOf(ConnectionHandler)
        })
    })

    describe('handleConnection()', () => {
        it('should register client in registry', async () => {
            const socket = new MockWebSocket() as any
            const connection: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            await connectionHandler.handleConnection(connection)

            expect(registry.get('client-1')).toBe(connection)
        })

        it('should return same connection for duplicate registration', async () => {
            const socket = new MockWebSocket() as any
            const connection: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            await connectionHandler.handleConnection(connection)
            await connectionHandler.handleConnection(connection)

            expect(registry.getCount()).toBe(1)
        })
    })

    describe('handleDisconnection()', () => {
        it('should unregister client from registry', async () => {
            const socket = new MockWebSocket() as any
            const connection: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            await connectionHandler.handleConnection(connection)
            expect(registry.get('client-1')).toBeDefined()

            await connectionHandler.handleDisconnection('client-1')
            expect(registry.get('client-1')).toBeUndefined()
        })

        it('should return silently for non-existent client', async () => {
            // Should not throw
            await expect(
                connectionHandler.handleDisconnection('non-existent'),
            ).resolves.toBeUndefined()
        })

        it('should accept optional reason parameter', async () => {
            const socket = new MockWebSocket() as any
            const connection: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            await connectionHandler.handleConnection(connection)
            await connectionHandler.handleDisconnection(
                'client-1',
                'Client disconnect',
            )

            expect(registry.get('client-1')).toBeUndefined()
        })
    })
})

describe('MessageHandler', () => {
    let registry: ClientRegistry
    let context: ContextManager
    let messageHandler: MessageHandler
    let testChannel: Channel<{ text: string }>

    beforeEach(() => {
        registry = new ClientRegistry()
        context = new ContextManager()
        messageHandler = new MessageHandler({
            registry,
            context,
        })

        // Create a test channel
        testChannel = new Channel({
            name: 'test-channel',
            registry,
        })
        registry.registerChannel(testChannel as any)
    })

    describe('handleMessage()', () => {
        it('should throw error for non-DataMessage', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            const invalidMessage = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.PING,
                channel: 'system',
                timestamp: Date.now(),
            } as any

            await expect(
                messageHandler.handleMessage(client, invalidMessage),
            ).rejects.toThrow(MessageError)
            await expect(
                messageHandler.handleMessage(client, invalidMessage),
            ).rejects.toThrow('Invalid message type')
        })

        it('should throw error when channel not found and requireChannel is true', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            const message: DataMessage<string> = {
                id: 'msg-1',
                type: MessageType.DATA,
                channel: 'non-existent',
                data: 'hello',
                timestamp: Date.now(),
            }

            await expect(
                messageHandler.handleMessage(client, message),
            ).rejects.toThrow(ChannelError)
            await expect(
                messageHandler.handleMessage(client, message),
            ).rejects.toThrow('Channel not found')
        })

        it('should dispatch message to channel', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            const message: DataMessage<{ text: string }> = {
                id: 'msg-1',
                type: MessageType.DATA,
                channel: 'test-channel',
                data: { text: 'hello' },
                timestamp: Date.now(),
            }

            // Subscribe client to channel
            testChannel.subscribe(client.id)

            // Handler should complete without error
            await expect(
                messageHandler.handleMessage(client, message),
            ).resolves.toBeUndefined()
        })
    })
})

describe('SignalHandler', () => {
    let registry: ClientRegistry
    let context: ContextManager
    let signalHandler: SignalHandler
    let testChannel: Channel<string>

    beforeEach(() => {
        registry = new ClientRegistry()
        context = new ContextManager()
        signalHandler = new SignalHandler({
            registry,
            context,
        })

        // Create a test channel
        testChannel = new Channel({
            name: 'test-channel',
            registry,
        })
        registry.registerChannel(testChannel as any)
    })

    describe('constructor', () => {
        it('should create handler', () => {
            expect(signalHandler).toBeInstanceOf(SignalHandler)
        })
    })

    describe('handleSignal()', () => {
        it('should handle SUBSCRIBE signal', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            // Register client in registry first
            registry.register(client)

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.SUBSCRIBE,
                channel: 'test-channel',
                timestamp: Date.now(),
            } as any

            await signalHandler.handleSignal(client, message)

            expect(registry.isSubscribed('client-1', 'test-channel')).toBe(true)
        })

        it('should handle UNSUBSCRIBE signal', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            // Register client and subscribe
            registry.register(client)
            registry.subscribe('client-1', 'test-channel')

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.UNSUBSCRIBE,
                channel: 'test-channel',
                timestamp: Date.now(),
            } as any

            await signalHandler.handleSignal(client, message)

            expect(registry.isSubscribed('client-1', 'test-channel')).toBe(
                false,
            )
        })

        it('should handle PING signal', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
                lastPingAt: Date.now() - 10000,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.PING,
                channel: undefined,
                timestamp: Date.now(),
            } as any

            await signalHandler.handleSignal(client, message)

            // Should have updated lastPingAt
            expect(client.lastPingAt).toBeGreaterThan(Date.now() - 1000)

            // Should have sent PONG response
            expect(socket.sent.length).toBeGreaterThan(0)
            const pongMsg = JSON.parse(socket.sent[0])
            expect(pongMsg.signal).toBe(SignalType.PONG)
        })

        it('should handle PONG signal', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
                lastPingAt: Date.now() - 10000,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.PONG,
                channel: undefined,
                timestamp: Date.now(),
            } as any

            await signalHandler.handleSignal(client, message)

            // Should have updated lastPingAt
            expect(client.lastPingAt).toBeGreaterThan(Date.now() - 1000)
        })

        it('should throw error for unknown signal type', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: 'UNKNOWN' as SignalType,
                channel: undefined,
                timestamp: Date.now(),
            } as any

            await expect(
                signalHandler.handleSignal(client, message),
            ).rejects.toThrow(MessageError)
        })
    })

    describe('handleSubscribe()', () => {
        it('should throw error for reserved channel names', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.SUBSCRIBE,
                channel: '__private__',
                timestamp: Date.now(),
            } as any

            await expect(
                signalHandler.handleSubscribe(client, message),
            ).rejects.toThrow(ChannelError)
        })

        it('should throw error for broadcast channel', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            // Register client first
            registry.register(client)

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.SUBSCRIBE,
                channel: '__broadcast__',
                timestamp: Date.now(),
            } as any

            await expect(
                signalHandler.handleSubscribe(client, message),
            ).rejects.toThrow(ChannelError)
            // __broadcast__ is a reserved channel, so it fails that check first
            await expect(
                signalHandler.handleSubscribe(client, message),
            ).rejects.toThrow('reserved channel')
        })

        it('should send acknowledgment when enabled', async () => {
            const handler = new SignalHandler({
                registry,
                context,
                options: {
                    sendAcknowledgments: true,
                },
            })

            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            // Register client first
            registry.register(client)

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.SUBSCRIBE,
                channel: 'test-channel',
                timestamp: Date.now(),
            } as any

            await handler.handleSubscribe(client, message)

            expect(socket.sent.length).toBeGreaterThan(0)
            const ack = JSON.parse(socket.sent[0])
            expect(ack.signal).toBe(SignalType.SUBSCRIBED)
            expect(ack.id).toBe('msg-1')
        })
    })

    describe('handleUnsubscribe()', () => {
        it('should throw error when not subscribed', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.UNSUBSCRIBE,
                channel: 'test-channel',
                timestamp: Date.now(),
            } as any

            await expect(
                signalHandler.handleUnsubscribe(client, message),
            ).rejects.toThrow(ChannelError)
        })

        it('should send acknowledgment when enabled', async () => {
            // First register and subscribe
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
            }
            registry.register(client)
            registry.subscribe('client-1', 'test-channel')

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.UNSUBSCRIBE,
                channel: 'test-channel',
                timestamp: Date.now(),
            } as any

            await signalHandler.handleUnsubscribe(client, message)

            expect(socket.sent.length).toBeGreaterThan(0)
            const ack = JSON.parse(socket.sent[0])
            expect(ack.signal).toBe(SignalType.UNSUBSCRIBED)
        })
    })

    describe('handlePing()', () => {
        it('should auto-respond with PONG when enabled', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
                lastPingAt: 0,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.PING,
                channel: 'test-channel',
                timestamp: Date.now(),
            } as any

            await signalHandler.handlePing(client, message)

            expect(socket.sent.length).toBeGreaterThan(0)
            const pong = JSON.parse(socket.sent[0])
            expect(pong.signal).toBe(SignalType.PONG)
        })

        it('should update client lastPingAt', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
                lastPingAt: 0,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.PING,
                channel: undefined,
                timestamp: Date.now(),
            } as any

            await signalHandler.handlePing(client, message)

            expect(client.lastPingAt).toBeGreaterThan(0)
        })
    })

    describe('handlePong()', () => {
        it('should update client lastPingAt', async () => {
            const socket = new MockWebSocket() as any
            const client: IClientConnection = {
                id: 'client-1',
                connectedAt: Date.now(),
                socket,
                lastPingAt: 0,
            }

            const message = {
                id: 'msg-1',
                type: MessageType.SIGNAL,
                signal: SignalType.PONG,
                channel: undefined,
                timestamp: Date.now(),
            } as any

            await signalHandler.handlePong(client, message)

            expect(client.lastPingAt).toBeGreaterThan(0)
        })
    })
})
