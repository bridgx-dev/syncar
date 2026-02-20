import type { WebSocket as WSWebSocket, WebSocketServer } from 'ws';

type TunnelOptions = {
    port?: number;
    host?: string;
    server?: any;
    url?: string;
};

type TunnelChannelOptions = {
    tunnel: Tunnel;
    name: string;
    dynamic?: boolean;
};

class Tunnel {
    wsServer?: WebSocketServer;
    wsClient?: WebSocket;
    private isServer: boolean;
    status: 'connecting' | 'open' | 'closed' = 'connecting';
    private statusListeners: Set<(status: Tunnel['status']) => void> = new Set();
    private options: TunnelOptions;

    constructor(options: TunnelOptions = {}) {
        this.options = options;
        this.isServer = typeof window === 'undefined';

        if (this.isServer) {
            // Only auto-initialize if port or server is provided
            if (options.server || options.port) {
                this.initServer(options);
            }
        } else {
            const url = options.url || `ws://${window.location.hostname}:${options.port || 3000}`;
            this.wsClient = new WebSocket(url);
            this.wsClient.onopen = () => this.updateStatus('open');
            this.wsClient.onclose = () => this.updateStatus('closed');
            this.wsClient.onerror = () => this.updateStatus('closed');
        }
    }

    /**
     * Attach the tunnel to an existing HTTP server (Server-side only)
     */
    attachToServer(server: any) {
        if (!this.isServer) return;
        if (this.wsServer) {
            console.warn('Tunnel already has a server attached.');
            return;
        }
        this.initServer({ ...this.options, server });
    }

    private updateStatus(newStatus: Tunnel['status']) {
        this.status = newStatus;
        this.statusListeners.forEach((l) => l(newStatus));
    }

    onStatusChange(callback: (status: Tunnel['status']) => void) {
        this.statusListeners.add(callback);
        return () => {
            this.statusListeners.delete(callback);
        };
    }

    private callbacks: Set<(message: any, sender?: WSWebSocket) => void> = new Set();

    onMessage(callback: (message: any, sender?: WSWebSocket) => void) {
        this.callbacks.add(callback);

        if (!this.isServer && this.wsClient) {
            this.wsClient.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.callbacks.forEach((cb) => cb(message));
                } catch (e) {
                    console.error('Failed to parse message', e);
                }
            };
        }
    }

    private async initServer(options: TunnelOptions) {
        try {
            // Using dynamic import for ESM compatibility and to prevent bundling in browser
            const { WebSocketServer } = await import('ws');
            this.wsServer = new WebSocketServer(
                options.server ? { server: options.server } : { port: options.port || 3000 },
            );

            this.wsServer.on('connection', (socket: WSWebSocket) => {
                socket.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.callbacks.forEach((cb) => cb(message, socket));

                        // Auto-broadcast to other clients
                        this.wsServer?.clients.forEach((client) => {
                            if (client !== socket && client.readyState === 1) {
                                client.send(data.toString());
                            }
                        });
                    } catch (e) {
                        console.error('Failed to parse message', e);
                    }
                });
            });
        } catch (e) {
            console.error('Failed to initialize WebSocketServer', e);
        }
    }

    send(message: any) {
        const payload = JSON.stringify(message);
        if (this.isServer) {
            if (this.wsServer) {
                this.wsServer.clients.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(payload);
                    }
                });
            }
        } else if (this.wsClient) {
            if (this.wsClient.readyState === WebSocket.OPEN) {
                this.wsClient.send(payload);
            } else {
                this.wsClient.addEventListener(
                    'open',
                    () => {
                        this.wsClient?.send(payload);
                    },
                    { once: true },
                );
            }
        }
    }
}

class TunnelChannel<T = any> {
    tunnel: Tunnel;
    name: string;
    dynamic?: boolean;
    private listeners: Set<(data: T) => void> = new Set();

    constructor(options: TunnelChannelOptions) {
        this.tunnel = options.tunnel;
        this.name = options.name;
        this.dynamic = options.dynamic;

        this.tunnel.onMessage((message) => {
            if (message.channel === this.name) {
                this.listeners.forEach((cb) => cb(message.data));
            }
        });
    }

    send(data: T) {
        this.tunnel.send({
            channel: this.name,
            data: data,
        });
    }

    receive(callback: (data: T) => void) {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }
}

export { Tunnel, TunnelChannel };
