import {
    type ChannelName,
    type ClientId,
    type SubscriberId,
    type DataMessage,
    type IClientConnection,
    type IMiddleware,
    type ChannelOptions,
    type ChannelScope,
    type ChannelFlow,
} from './types'
import {
    assertValidChannelName
} from './utils'
import { ClientRegistry } from './registry'
import { BaseChannel, type IPublishOptions, type IMessageHandler } from './channel'

/**
 * Unified Channel - supports both broadcast and multicast modes
 *
 * @remarks
 * A single channel class that replaces `BroadcastChannel` and `MulticastChannel`.
 * Behavior is controlled by `scope` and `flow` options:
 *
 * - **scope: 'broadcast'**: Sends to ALL clients, no subscription concept
 * - **scope: 'subscribers'**: Sends only to subscribed clients
 *
 * - **flow: 'bidirectional'**: Server and clients can send
 * - **flow: 'send-only'**: Only server can send
 * - **flow: 'receive-only'**: Only clients can send
 *
 * @template T - Type of data published on this channel (default: unknown)
 *
 * @example
 * ### Default: subscribers + bidirectional (chat room)
 * ```ts
 * const chat = server.createChannel('chat')
 * chat.onMessage((data, client) => {
 *   console.log(`${client.id}: ${data.text}`)
 *   chat.publish(data, { exclude: [client.id] })
 * })
 * ```
 *
 * @example
 * ### Broadcast: all clients, send-only (announcements)
 * ```ts
 * const alerts = server.createChannel('alerts', { scope: 'broadcast' })
 * alerts.publish({ type: 'warning', message: 'Server maintenance' })
 * // alerts.subscribe() - ❌ Method not available for broadcast
 * ```
 *
 * @example
 * ### Subscribers + send-only (live dashboard)
 * ```ts
 * const updates = server.createChannel('updates', { flow: 'send-only' })
 * updates.publish({ cpu: 45, memory: 67 })
 * // updates.onMessage() - ❌ Error in send-only mode
 * ```
 */
export class Channel<T = unknown> extends BaseChannel<T> {
    private readonly middlewares: IMiddleware[] = []
    private readonly messageHandlers: Set<IMessageHandler<T>> = new Set()

    /** The channel scope: 'broadcast' or 'subscribers' */
    public readonly scope: ChannelScope

    /** The channel flow: 'bidirectional', 'send-only', or 'receive-only' */
    public readonly flow: ChannelFlow

    /**
     * Creates a new Channel instance
     *
     * @param config.name - The channel name
     * @param config.registry - The client registry
     * @param config.options - Channel options (scope, flow)
     * @param config.chunkSize - Broadcast chunk size
     *
     * @throws {Error} If scope is 'broadcast' and flow is not 'send-only'
     *
     * @example
     * ```ts
     * new Channel({
     *   name: 'chat',
     *   registry: registry,
     *   options: { scope: 'subscribers', flow: 'bidirectional' }
     * })
     * ```
     */
    constructor(config: {
        name: ChannelName
        registry: ClientRegistry
        options?: ChannelOptions
        chunkSize?: number
    }) {
        const { name, registry, options, chunkSize } = config

        // Apply defaults
        // Broadcast scope automatically sets flow to send-only
        const scope = options?.scope ?? 'subscribers'
        const flow = options?.flow ?? (scope === 'broadcast' ? 'send-only' : 'bidirectional')

        // Validation: broadcast scope only allows send-only flow
        if (scope === 'broadcast' && flow !== 'send-only') {
            throw new Error(
                `Invalid channel configuration: broadcast scope only supports send-only flow. ` +
                `Got scope '${scope}' and flow '${flow}'.`
            )
        }

        // For broadcast scope, use the broadcast channel name
        const channelName = scope === 'broadcast' ? '__broadcast__' : name

        // Validate channel name
        assertValidChannelName(channelName)

        super(channelName, registry, chunkSize)

        this.scope = scope
        this.flow = flow
    }

    /**
     * Get target clients based on scope
     *
     * @internal
     */
    protected getTargetClients(_options?: IPublishOptions): ClientId[] {
        if (this.scope === 'broadcast') {
            return Array.from(this.registry.connections.keys())
        }
        return Array.from(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Get the number of subscribers/clients
     *
     * @returns Number of clients that will receive messages
     *
     * @example
     * ```ts
     * console.log(`Channel reach: ${channel.subscriberCount}`)
     * ```
     */
    get subscriberCount(): number {
        if (this.scope === 'broadcast') {
            return this.registry.connections.size
        }
        return this.registry.getChannelSubscribers(this.name).size
    }

    /**
     * Check if channel has no subscribers/clients
     *
     * @returns `true` if no clients will receive messages
     *
     * @example
     * ```ts
     * if (channel.isEmpty()) {
     *   console.log('No one is listening')
     * }
     * ```
     */
    isEmpty(): boolean {
        return this.subscriberCount === 0
    }

    /**
     * Get middleware for this channel
     *
     * @internal
     */
    getMiddlewares(): IMiddleware[] {
        return [...this.middlewares]
    }

    /**
     * Register channel-specific middleware
     *
     * @param middleware - The middleware function
     *
     * @example
     * ```ts
     * channel.use(async (context, next) => {
     *   console.log(`Action: ${context.req.action}`)
     *   await next()
     * })
     * ```
     */
    use(middleware: IMiddleware): void {
        this.middlewares.push(middleware)
    }

    /**
     * Register a message handler (not available in send-only mode)
     *
     * @param handler - The message handler function
     * @returns Unsubscribe function
     * @throws {Error} If flow is 'send-only'
     *
     * @example
     * ```ts
     * const unsubscribe = channel.onMessage((data, client) => {
     *   console.log(`Received from ${client.id}:`, data)
     * })
     *
     * // Later
     * unsubscribe()
     * ```
     */
    onMessage(handler: IMessageHandler<T>): () => void {
        if (this.flow === 'send-only') {
            throw new Error(
                `Cannot register message handler on channel '${this.name}': ` +
                `onMessage is not available in send-only mode.`
            )
        }
        this.messageHandlers.add(handler)
        return () => this.messageHandlers.delete(handler)
    }

    /**
     * Subscribe a client (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if subscribed successfully
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * channel.subscribe('client-123')
     * ```
     */
    subscribe(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot subscribe to channel '${this.name}': ` +
                `subscribe is not available for broadcast channels. ` +
                `Broadcast channels send to all clients automatically.`
            )
        }
        return this.registry.subscribe(subscriber, this.name)
    }

    /**
     * Unsubscribe a client (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if unsubscribed successfully
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * channel.unsubscribe('client-123')
     * ```
     */
    unsubscribe(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot unsubscribe from channel '${this.name}': ` +
                `unsubscribe is not available for broadcast channels.`
            )
        }
        return this.registry.unsubscribe(subscriber, this.name)
    }

    /**
     * Check if a client is subscribed (only available for subscriber scope)
     *
     * @param subscriber - The subscriber ID
     * @returns `true` if subscribed
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * if (channel.hasSubscriber('client-123')) {
     *   console.log('Client is subscribed')
     * }
     * ```
     */
    hasSubscriber(subscriber: SubscriberId): boolean {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot check subscribers on channel '${this.name}': ` +
                `hasSubscriber is not available for broadcast channels.`
            )
        }
        return this.registry.getChannelSubscribers(this.name).has(subscriber)
    }

    /**
     * Get all subscribers (only available for subscriber scope)
     *
     * @returns Set of subscriber IDs
     * @throws {Error} If scope is 'broadcast'
     *
     * @example
     * ```ts
     * const subs = channel.getSubscribers()
     * console.log(`Subscribers: ${Array.from(subs).join(', ')}`)
     * ```
     */
    getSubscribers(): Set<SubscriberId> {
        if (this.scope === 'broadcast') {
            throw new Error(
                `Cannot get subscribers on channel '${this.name}': ` +
                `getSubscribers is not available for broadcast channels.`
            )
        }
        return new Set(this.registry.getChannelSubscribers(this.name))
    }

    /**
     * Dispatch an incoming client message
     *
     * @internal
     */
    override async dispatch(
        data: T,
        client: IClientConnection,
        message: DataMessage<T>,
    ): Promise<void> {
        // Send-only channels don't receive client messages
        if (this.flow === 'send-only') {
            return
        }

        if (this.messageHandlers.size > 0) {
            // Intercept mode: handlers process the message
            for (const handler of this.messageHandlers) {
                try {
                    await handler(data, client, message)
                } catch (error) {
                    this.registry.logger?.error(
                        `[${this.name}] Error in message handler:`,
                        error as Error,
                    )
                }
            }
        } else {
            // Auto-relay mode: forward to all subscribers except sender
            // Only for subscriber scope with bidirectional flow
            if (this.scope === 'subscribers') {
                this.publish(data, { exclude: [client.id] })
            }
        }
    }
}
