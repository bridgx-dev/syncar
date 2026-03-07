import type {
    IClientConnection,
    ClientId,
    ChannelName,
} from './types'
import { BaseChannel, MulticastChannel } from './channel'

/**
 * Client Registry
 * Manages connected clients, their subscriptions, and channel instances.
 */
export class ClientRegistry {
    public readonly connections: Map<ClientId, IClientConnection> = new Map()
    private readonly subscriptions: Map<ClientId, Set<ChannelName>> = new Map()
    private readonly channels: Map<ChannelName, Set<ClientId>> = new Map()
    private readonly channelInstances: Map<ChannelName, MulticastChannel<any>> = new Map()

    register(connection: IClientConnection): IClientConnection {
        this.connections.set(connection.id, connection)
        return connection
    }

    unregister(clientId: ClientId): boolean {
        const connection = this.get(clientId)
        if (!connection) return false

        this.clearSubscriptions(connection)
        return this.connections.delete(clientId)
    }

    private clearSubscriptions(connection: IClientConnection): void {
        const clientChannels = this.subscriptions.get(connection.id)
        if (!clientChannels) return

        for (const channelName of clientChannels) {
            this.channels.get(channelName)?.delete(connection.id);
            (this.getChannel(channelName) as any)?.handleUnsubscribe(connection)
        }

        this.subscriptions.delete(connection.id)
    }

    get(clientId: ClientId): IClientConnection | undefined {
        return this.connections.get(clientId)
    }

    getAll(): IClientConnection[] {
        return Array.from(this.connections.values())
    }

    getCount(): number {
        return this.connections.size
    }

    registerChannel(channel: BaseChannel<unknown>): void {
        // Create channel in internal map if not exists
        if (!this.channels.has(channel.name)) {
            this.channels.set(channel.name, new Set())
        }
        // Store the channel instance
        this.channelInstances.set(channel.name, channel as unknown as MulticastChannel<any>)
    }

    getChannel<T = unknown>(name: ChannelName): BaseChannel<T> | undefined {
        return this.channelInstances.get(name) as unknown as BaseChannel<T> | undefined
    }

    removeChannel(name: ChannelName): boolean {
        const subscribers = this.channels.get(name)
        if (!subscribers) return false

        // Remove channel from all subscribers' subscription sets
        for (const clientId of subscribers) {
            const clientChannels = this.subscriptions.get(clientId)
            if (clientChannels) {
                clientChannels.delete(name)
            }
        }

        // Remove the channel instance
        this.channelInstances.delete(name)

        // Remove the channel
        return this.channels.delete(name)
    }

    subscribe(clientId: ClientId, channel: ChannelName): boolean {
        // Verify client exists
        if (!this.connections.has(clientId)) return false

        // Create channel if not exists
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set())
        }

        const subscribers = this.channels.get(channel)!

        // Check if already subscribed
        if (subscribers.has(clientId)) return true

        // Add to channels map (reverse index)
        subscribers.add(clientId)

        // Add to subscriptions map (forward index)
        if (!this.subscriptions.has(clientId)) {
            this.subscriptions.set(clientId, new Set())
        }
        this.subscriptions.get(clientId)!.add(channel)

        return true
    }

    unsubscribe(clientId: ClientId, channel: ChannelName): boolean {
        const subscribers = this.channels.get(channel)
        if (!subscribers || !subscribers.has(clientId)) return false

        // Remove from channels map (reverse index)
        subscribers.delete(clientId)

        // Remove from subscriptions map (forward index)
        const clientChannels = this.subscriptions.get(clientId)
        if (clientChannels) {
            clientChannels.delete(channel)
            // Clean up empty subscription sets
            if (clientChannels.size === 0) {
                this.subscriptions.delete(clientId)
            }
        }

        return true
    }

    getSubscribers(channel: ChannelName): IClientConnection[] {
        const subscriberIds = this.channels.get(channel)
        if (!subscriberIds) return []

        const subscribers: IClientConnection[] = []
        for (const id of subscriberIds) {
            const client = this.connections.get(id)
            if (client) {
                subscribers.push(client)
            }
        }

        return subscribers
    }

    getSubscriberCount(channel: ChannelName): number {
        return this.channels.get(channel)?.size ?? 0
    }

    getChannels(): ChannelName[] {
        return Array.from(this.channels.keys())
    }

    getTotalSubscriptionCount(): number {
        let total = 0
        for (const subscribers of this.channels.values()) {
            total += subscribers.size
        }
        return total
    }

    isSubscribed(clientId: ClientId, channel: ChannelName): boolean {
        return this.channels.get(channel)?.has(clientId) ?? false
    }

    getClientChannels(clientId: ClientId): Set<ChannelName> {
        return this.subscriptions.get(clientId) ?? new Set()
    }

    getChannelSubscribers(channel: ChannelName): Set<ClientId> {
        return this.channels.get(channel) ?? new Set()
    }

    clear(): void {
        this.connections.clear()
        this.subscriptions.clear()
        this.channels.clear()
        this.channelInstances.clear()
    }
}
