/**
 * Channel class for managing subscribers and broadcasting
 * A channel represents a named topic that clients can subscribe to
 */

import type {
    ChannelName,
    ChannelState,
    SubscriberId,
    Timestamp,
    DataPayload,
} from './types.js'
import type { Message } from './protocol.js'

/**
 * Channel options
 */
export interface ChannelOptions {
    /**
     * Maximum number of subscribers (0 = unlimited)
     * @default 0
     */
    maxSubscribers?: number

    /**
     * Whether this channel is reserved (system use only)
     * @default false
     */
    reserved?: boolean

    /**
     * Message history size (0 = no history)
     * @default 0
     */
    historySize?: number
}

/**
 * Channel class for managing subscriptions and message broadcasting
 */
export class Channel<T = unknown> {
    public readonly name: ChannelName
    protected readonly subscribers: Set<SubscriberId> = new Set()
    protected readonly options: Required<ChannelOptions>
    protected messageHistory: Message<T>[] = []
    protected _createdAt: Timestamp

    constructor(name: ChannelName, options: ChannelOptions = {}) {
        this.name = name
        this._createdAt = Date.now()
        this.options = {
            maxSubscribers: options.maxSubscribers ?? 0,
            reserved: options.reserved ?? false,
            historySize: options.historySize ?? 0,
        }
    }

    /**
     * Get the channel state
     */
    getState(): ChannelState<T> {
        return {
            name: this.name,
            subscriberCount: this.subscribers.size,
            createdAt: this._createdAt,
            lastMessageAt:
                this.messageHistory.length > 0
                    ? this.messageHistory[this.messageHistory.length - 1]
                          ?.timestamp
                    : undefined,
        }
    }

    /**
     * Check if a subscriber is in this channel
     */
    hasSubscriber(subscriber: SubscriberId): boolean {
        return this.subscribers.has(subscriber)
    }

    /**
     * Get all subscribers
     */
    getSubscribers(): Set<SubscriberId> {
        return new Set(this.subscribers)
    }

    /**
     * Get subscriber count
     */
    getSubscriberCount(): number {
        return this.subscribers.size
    }

    /**
     * Check if channel is empty
     */
    isEmpty(): boolean {
        return this.subscribers.size === 0
    }

    /**
     * Check if channel is full
     */
    isFull(): boolean {
        return (
            this.options.maxSubscribers > 0 &&
            this.subscribers.size >= this.options.maxSubscribers
        )
    }

    /**
     * Subscribe a client to this channel
     * @returns true if subscription succeeded, false otherwise
     */
    subscribe(subscriber: SubscriberId): boolean {
        // Check if already subscribed
        if (this.subscribers.has(subscriber)) {
            return false
        }

        // Check if channel is full
        if (this.isFull()) {
            return false
        }

        this.subscribers.add(subscriber)
        return true
    }

    /**
     * Unsubscribe a client from this channel
     * @returns true if subscriber was removed, false if not found
     */
    unsubscribe(subscriber: SubscriberId): boolean {
        return this.subscribers.delete(subscriber)
    }

    /**
     * Add a message to history (if history is enabled)
     */
    protected addToHistory(message: Message<T>): void {
        if (this.options.historySize > 0) {
            this.messageHistory.push(message)
            if (this.messageHistory.length > this.options.historySize) {
                this.messageHistory.shift()
            }
        }
    }

    /**
     * Get message history
     */
    getHistory(): Message<T>[] {
        return [...this.messageHistory]
    }

    /**
     * Clear message history
     */
    clearHistory(): void {
        this.messageHistory = []
    }

    /**
     * Clear all subscribers (e.g., on shutdown)
     */
    clear(): void {
        this.subscribers.clear()
    }

    /**
     * Check if this is a reserved channel
     */
    isReserved(): boolean {
        return this.options.reserved
    }

    /**
     * Validate channel name
     * Channel names starting with '__' are reserved for system use
     */
    static isValidChannelName(name: ChannelName): boolean {
        return typeof name === 'string' && name.length > 0 && name.length <= 128
    }

    /**
     * Check if channel name is reserved
     */
    static isReservedName(name: ChannelName): boolean {
        return name.startsWith('__')
    }

    /**
     * Create a reserved channel
     */
    static createReserved(
        name: ChannelName,
        options?: Omit<ChannelOptions, 'reserved'>,
    ): Channel {
        if (!Channel.isReservedName(name)) {
            throw new Error(
                `Reserved channel names must start with '__': ${name}`,
            )
        }
        return new Channel(name, { ...options, reserved: true })
    }
}
