import type { WebSocket as WSWebSocket, WebSocketServer } from 'ws';
import type { TunnelOptions, TunnelStore, TunnelBase } from './types';
import { MemoryStore, RedisStore } from './Store';

/**
 * Server-side Tunnel implementation.
 */
export class Tunnel implements TunnelBase {
    wsServer?: WebSocketServer;
    wsClient?: any; // Required by interface but null on server
    status: 'connecting' | 'open' | 'closed' = 'open';
    protected options: TunnelOptions;
    protected callbacks: Set<(message: any, sender?: WSWebSocket) => void> = new Set();
    protected store?: TunnelStore;

    constructor(options: TunnelOptions = {}) {
        this.options = options;

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
        if (this.wsServer) {
            console.warn('Tunnel already has a server attached.');
            return;
        }
        this.initServer({ ...this.options, server });
    }

    onMessage(callback: (message: any, sender?: WSWebSocket) => void) {
        this.callbacks.add(callback);
    }

    protected async initServer(options: TunnelOptions) {
        try {
            if (this.store) {
                await this.store.ready;
            }

            const { WebSocketServer } = await import('ws');
            this.wsServer = new WebSocketServer(
                options.server ? { server: options.server } : { port: options.port || 3000 },
            );

            this.wsServer.on('connection', async (socket: WSWebSocket) => {
                const clientId = Math.random().toString(36).substring(2, 11);
                if (this.store) {
                    await this.store.registerClient(clientId, socket);
                }

                socket.on('message', async (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        
                        // Handle Signal Plane (Internal Subscriptions)
                        if (message.type === 'signal' && this.store) {
                            if (message.signal === 'subscribe') {
                                await this.store.subscribe(clientId, message.channel);
                            } else if (message.signal === 'unsubscribe') {
                                await this.store.unsubscribe(clientId, message.channel);
                            }
                            return;
                        }

                        // Trigger local listeners
                        this.callbacks.forEach((cb) => cb(message, socket));

                        // Targeted Relay
                        if (this.store) {
                            const subscriberIds = await this.store.getSubscribers(message.channel);
                            const allClients = await this.store.getAllClients();
                            const payload = JSON.stringify(message);
                            
                            subscriberIds.forEach((id) => {
                                const s = allClients.get(id);
                                if (s && s !== socket && s.readyState === 1) {
                                    s.send(payload);
                                }
                            });
                        } else {
                            // Fallback broadcast
                            this.wsServer?.clients.forEach((client) => {
                                if (client !== socket && client.readyState === 1) {
                                    client.send(data.toString());
                                }
                            });
                        }
                    } catch (e) {
                        console.error('Failed to parse message', e);
                    }
                });

                socket.on('close', async () => {
                    if (this.store) {
                        await this.store.unregisterClient(clientId);
                    }
                });
            });
        } catch (e) {
            console.error('Failed to initialize WebSocketServer', e);
        }
    }

    async send(message: any) {
        const payload = JSON.stringify(message);
        // Server sends to channel subscribers
        if (this.store) {
            const subscriberIds = await this.store.getSubscribers(message.channel);
            const allClients = await this.store.getAllClients();
            subscriberIds.forEach(id => {
                const s = allClients.get(id);
                if (s && s.readyState === 1) s.send(payload);
            });
        } else if (this.wsServer) {
            this.wsServer.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(payload);
                }
            });
        }
    }

    disconnect() {
        if (this.wsServer) {
            this.wsServer.close();
        }
    }
}
