/**
 * Syncar Client
 * Framework-agnostic real-time synchronization client
 */

import {
    MessageType,
    SignalType,
    type Message,
    type DataMessage,
    type ChannelName,
} from '@syncar/types'
import {
    generateMessageId,
    createDataMessage,
    generateClientId,
} from '@syncar/lib'
import type {
    ClientConfig,
    ClientStatus,
    ClientEventType,
    ClientEventMap,
    ChannelSubscription,
    SubscribeOptions,
    SubscriptionCallbacks,
    ClientStats,
} from './types.js'
import { ConnectionManager } from './connection-manager.js'
import { ChannelSubscriptionImpl } from './channel-subscription.js'

/**
 * Syncar Client
 * Main client class for real-time communication
 */
export class SyncarClient {
    public readonly id: string
    private connectionManager: ConnectionManager
    private subscriptions: Map<ChannelName, ChannelSubscriptionImpl> = new Map()

    private eventHandlers: Map<
        ClientEventType,
        Set<ClientEventMap[ClientEventType]>
    > = new Map()

    private messagesReceived = 0
    private messagesSent = 0

    private transportUnsubs: Array<() => void> = []

    constructor(config: ClientConfig) {
        // Generate or use provided client ID
        this.id = config.id || this.generateClientId()

        // Create connection manager
        this.connectionManager = new ConnectionManager(config)

        // Set up transport event handlers
        this.setupTransportHandlers(config.transport)

        // Set up connection manager handlers
        this.setupConnectionManagerHandlers()

        // Handle auto-connect
        if (config.autoConnect) {
            // Background connect, errors are handled by ConnectionManager
            void this.connect().catch(() => {})
        }
    }

    /**
     * Current connection status
     */
    get status(): ClientStatus {
        return this.connectionManager.status
    }

    /**
     * Connect to the server
     */
    async connect(): Promise<void> {
        return this.connectionManager.connect()
    }

    /**
     * Disconnect from the server
     */
    async disconnect(): Promise<void> {
        return this.connectionManager.disconnect()
    }

    /**
     * Subscribe to a channel
     */
    async subscribe<T = unknown>(
        channel: ChannelName,
        callbacks?: SubscriptionCallbacks<T>,
        options?: SubscribeOptions,
    ): Promise<ChannelSubscription<T>> {
        let subscription = this.subscriptions.get(channel) as
            | ChannelSubscriptionImpl<T>
            | undefined

        if (!subscription) {
            // Create new subscription
            subscription = new ChannelSubscriptionImpl<T>(channel, {
                ...options,
                callbacks,
            })

            // Set up send functions
            subscription.sendSubscribe = async (
                ch: ChannelName,
                data?: unknown,
            ) => {
                await this.sendSignal(SignalType.SUBSCRIBE, ch, data)
            }

            subscription.sendUnsubscribe = async (ch: ChannelName) => {
                await this.sendSignal(SignalType.UNSUBSCRIBE, ch)
            }

            this.subscriptions.set(
                channel,
                subscription as ChannelSubscriptionImpl,
            )
        }

        // Subscribe to the channel
        await subscription.subscribe(options)

        return subscription
    }

    /**
     * Unsubscribe from a channel
     */
    async unsubscribe(channel: ChannelName): Promise<void> {
        const subscription = this.subscriptions.get(channel)

        if (!subscription) {
            return
        }

        await subscription.unsubscribe()

        // Remove from map if not auto-resubscribe
        if (!subscription.autoResubscribe) {
            this.subscriptions.delete(channel)
            subscription.destroy()
        }
    }

    /**
     * Unsubscribe from all channels
     */
    async unsubscribeAll(): Promise<void> {
        const promises = Array.from(this.subscriptions.values()).map((sub) =>
            sub.unsubscribe(),
        )

        await Promise.all(promises)

        // Clear all subscriptions
        for (const sub of this.subscriptions.values()) {
            sub.destroy()
        }
        this.subscriptions.clear()
    }

    /**
     * Publish a message to a channel
     */
    async publish<T = unknown>(channel: ChannelName, data: T): Promise<void> {
        const message = createDataMessage(channel, data)
        await this.send(message)
        this.messagesSent++
    }

    /**
     * Get subscription for a channel
     */
    getSubscription<T = unknown>(
        channel: ChannelName,
    ): ChannelSubscription<T> | undefined {
        return this.subscriptions.get(channel) as
            | ChannelSubscription<T>
            | undefined
    }

    /**
     * Get all subscribed channels
     */
    getSubscribedChannels(): ChannelName[] {
        return Array.from(this.subscriptions.keys()).filter(
            (channel) =>
                this.subscriptions.get(channel)?.state === 'subscribed',
        )
    }

    /**
     * Register an event handler
     */
    on<E extends ClientEventType>(
        event: E,
        handler: ClientEventMap[E],
    ): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set())
        }

        this.eventHandlers.get(event)!.add(handler)

        return () => {
            const handlers = this.eventHandlers.get(event)
            if (handlers) {
                handlers.delete(handler)
            }
        }
    }

    /**
     * Get client statistics
     */
    getStats(): ClientStats {
        return {
            status: this.status,
            id: this.id,
            subscriptions: this.subscriptions.size,
            messagesReceived: this.messagesReceived,
            messagesSent: this.messagesSent,
            reconnectAttempts:
                this.connectionManager.getReconnectionState().attempts,
            connectedAt:
                this.connectionManager['config'].transport.getConnectionInfo?.()
                    ?.connectedAt,
            channels: this.getSubscribedChannels(),
        }
    }

    /**
     * Enable or disable auto-reconnect
     */
    setAutoReconnect(enabled: boolean): void {
        this.connectionManager.setAutoReconnect(enabled)
    }

    /**
     * Set up transport event handlers
     */
    private setupTransportHandlers(transport: ClientConfig['transport']): void {
        // Handle open
        const unsubOpen = transport.on('open', () => {
            this.emit('connected')
        })
        this.transportUnsubs.push(unsubOpen)

        // Handle message
        const unsubMessage = transport.on('message', (message: Message) => {
            this.handleMessage(message)
        })
        this.transportUnsubs.push(unsubMessage)

        // Handle error
        const unsubError = transport.on('error', (error: Error) => {
            this.connectionManager.onTransportError(error)
            this.emit('error', error)
        })
        this.transportUnsubs.push(unsubError)

        // Handle close
        const unsubClose = transport.on(
            'close',
            (event?: { code?: number; reason?: string }) => {
                this.connectionManager.onTransportClose(event)
                this.handleDisconnect()
                this.emit('disconnected', event)
            },
        )
        this.transportUnsubs.push(unsubClose)
    }

    /**
     * Set up connection manager handlers
     */
    private setupConnectionManagerHandlers(): void {
        this.connectionManager.onStatusChange((status) => {
            if (status === 'connecting' || status === 'reconnecting') {
                this.emit('connecting')
            } else if (status === 'connected') {
                this.emit('connected')
            } else if (status === 'disconnected') {
                this.emit('disconnected')
            }
        })

        this.connectionManager.onReconnecting((attempt) => {
            this.emit('reconnecting', attempt)
        })
    }

    /**
     * Handle incoming message
     */
    private handleMessage(message: Message): void {
        this.messagesReceived++

        // Emit to global message handlers
        this.emit('message', message)

        // Handle signal messages
        if (message.type === MessageType.SIGNAL) {
            this.handleSignalMessage(message)
            return
        }

        // Handle data messages
        if (message.type === MessageType.DATA) {
            const dataMessage = message as DataMessage
            const subscription = this.subscriptions.get(dataMessage.channel)

            if (subscription) {
                subscription.handleMessage(dataMessage)
            }
        }
    }

    /**
     * Handle signal message
     */
    private handleSignalMessage(
        message: Message & { signal?: SignalType },
    ): void {
        const { signal, channel } = message

        if (!signal || !channel) {
            return
        }

        const subscription = this.subscriptions.get(channel)

        if (subscription) {
            subscription.handleSignal(signal)
        }
    }

    /**
     * Handle disconnection
     */
    private handleDisconnect(): void {
        // Reset all subscription states
        for (const subscription of this.subscriptions.values()) {
            subscription.reset()
        }

        // Resubscribe to channels with autoResubscribe enabled after reconnection
        const resubscribe = async () => {
            if (this.status === 'connected') {
                for (const subscription of this.subscriptions.values()) {
                    if (
                        subscription.autoResubscribe &&
                        subscription.state === 'unsubscribed'
                    ) {
                        try {
                            await subscription.subscribe()
                        } catch (error) {
                            console.error(
                                `Failed to resubscribe to ${subscription.channel}:`,
                                error,
                            )
                        }
                    }
                }
            }
        }

        // Wait for reconnection then resubscribe
        this.connectionManager.onStatusChange((status) => {
            if (status === 'connected') {
                resubscribe()
            }
        })
    }

    /**
     * Send a message through the transport
     */
    private async send(message: Message): Promise<void> {
        const transport = this.connectionManager['config'].transport

        if (this.status !== 'connected') {
            throw new Error(`Cannot send message: client is ${this.status}`)
        }

        await transport.send(message)
    }

    /**
     * Send a signal message
     */
    private async sendSignal(
        signal: SignalType,
        channel: ChannelName,
        data?: unknown,
    ): Promise<void> {
        const message: Message = {
            id: generateMessageId(),
            type: MessageType.SIGNAL,
            channel,
            signal,
            data,
            timestamp: Date.now(),
        }

        await this.send(message)
        this.messagesSent++
    }

    /**
     * Emit an event to all registered handlers
     */
    private emit<E extends ClientEventType>(
        event: E,
        ...args: Parameters<ClientEventMap[E]>
    ): void {
        const handlers = this.eventHandlers.get(event)
        if (handlers) {
            for (const handler of handlers) {
                try {
                    ;(handler as any)(...args)
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error)
                }
            }
        }
    }

    /**
     * Generate a unique client ID
     */
    private generateClientId(): string {
        return generateClientId()
    }

    /**
     * Destroy the client and clean up resources
     */
    async destroy(): Promise<void> {
        // Unsubscribe from transport events
        for (const unsub of this.transportUnsubs) {
            unsub()
        }
        this.transportUnsubs = []

        // Disconnect
        await this.disconnect()

        // Clear all subscriptions
        for (const sub of this.subscriptions.values()) {
            sub.destroy()
        }
        this.subscriptions.clear()

        // Clear event handlers
        this.eventHandlers.clear()
    }
}

/**
 * Factory function to create a Syncar client
 */
export function createSyncarClient(config: ClientConfig): SyncarClient {
    return new SyncarClient(config)
}
