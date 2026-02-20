import { Channel } from './Channel';
import { Dispatcher } from './Dispatcher';
import { MemoryStore, RedisStore } from './store';
import { ServerTransport } from './transport/ServerTransport';
import type { TunnelOptions, TunnelStore, TunnelBase } from './types';

/**
 * Server-side Tunnel implementation.
 */
export class Tunnel implements TunnelBase {
    protected transport: ServerTransport;
    protected dispatcher: Dispatcher = new Dispatcher();
    protected options: TunnelOptions;
    protected store?: TunnelStore;
    protected socketToId: Map<any, string> = new Map();

    constructor(options: TunnelOptions = {}) {
        this.options = options;
        this.transport = new ServerTransport();

        // Initialize storage
        if (!options.storage || options.storage === 'memory') {
            this.store = new MemoryStore();
        } else if (options.storage === 'redis') {
            this.store = new RedisStore(options.redisOptions);
        } else if (typeof options.storage === 'object') {
            this.store = options.storage;
        }

        if (options.server || options.port) {
            this.initServer(options);
        }
    }

    /**
     * Attach the tunnel to an existing HTTP server.
     */
    attachToServer(server: any) {
        this.initServer({ ...this.options, server });
    }

    onMessage(callback: (message: any, sender?: any) => void) {
        this.dispatcher.onMessage(callback);
    }

    /**
     * Create a new channel directly from the tunnel.
     * This automatically binds the channel to this tunnel instance.
     */
    createChannel<T>(name: string): Channel<T> {
        return new Channel<T>({ tunnel: this, name });
    }

    protected async initServer(options: TunnelOptions) {
        try {
            if (this.store) {
                await this.store.ready;
            }

            this.transport.onConnection(async (socket) => {
                const clientId = Math.random().toString(36).substring(2, 11);
                this.socketToId.set(socket, clientId);
                if (this.store) {
                    await this.store.registerClient(clientId, socket);
                }
            });

            this.transport.onMessage(async (socket, data) => {
                const clientId = this.socketToId.get(socket);
                if (!clientId) return;

                const message = this.dispatcher.processRaw(data, socket);
                if (!message) return;

                // Handle Signal Plane (Internal Subscriptions)
                if (message.type === 'signal' && this.store) {
                    if (message.signal === 'subscribe') {
                        await this.store.subscribe(clientId, message.channel);
                    } else if (message.signal === 'unsubscribe') {
                        await this.store.unsubscribe(clientId, message.channel);
                    }
                    return;
                }

                // Targeted Relay
                if (this.store) {
                    const subscriberIds = await this.store.getSubscribers(message.channel);
                    const allClients = await this.store.getAllClients();
                    const payload = JSON.stringify(message);

                    subscriberIds.forEach((id) => {
                        const s = allClients.get(id);
                        if (s && s !== socket) {
                            this.transport.send(s, payload);
                        }
                    });
                } else {
                    // Fallback broadcast
                    this.transport.clients.forEach((client: any) => {
                        if (client !== socket) {
                            this.transport.send(client, data);
                        }
                    });
                }
            });

            this.transport.onClose(async (socket) => {
                const clientId = this.socketToId.get(socket);
                if (clientId) {
                    if (this.store) {
                        await this.store.unregisterClient(clientId);
                    }
                    this.socketToId.delete(socket);
                }
            });

            await this.transport.listen(options);
        } catch (e) {
            console.error('Failed to initialize Tunnel Server', e);
        }
    }

    async send(message: any) {
        const payload = JSON.stringify(message);
        // Server sends to channel subscribers
        if (this.store) {
            const subscriberIds = await this.store.getSubscribers(message.channel);
            const allClients = await this.store.getAllClients();
            subscriberIds.forEach((id) => {
                const s = allClients.get(id);
                if (s) this.transport.send(s, payload);
            });
        } else {
            this.transport.clients.forEach((client: any) => {
                this.transport.send(client, payload);
            });
        }
    }

    disconnect() {
        this.transport.close();
    }
}
