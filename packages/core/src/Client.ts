import { Channel } from './Channel';
import { ConnectionManager } from './ConnectionManager';
import { Dispatcher } from './Dispatcher';
import { ClientTransport } from './transport/ClientTransport';
import type { ClientOptions, TunnelMessage, TunnelBase } from './types';

export class Client implements TunnelBase {
    protected transport!: ClientTransport;
    protected connectionManager: ConnectionManager;
    protected dispatcher: Dispatcher = new Dispatcher();
    status: 'connecting' | 'open' | 'closed' = 'connecting';
    protected statusListeners: Set<(status: Client['status']) => void> = new Set();
    protected options: ClientOptions;
    protected activeSubscriptions: Set<string> = new Set();

    constructor(
        options: ClientOptions = {
            url: `ws://${window.location.hostname}:3000`,
        },
    ) {
        this.options = {
            reconnect: true,
            reconnectInterval: 1000,
            maxReconnectAttempts: Infinity,
            ...options,
        };
        const url = this.options.url!;
        this.connectionManager = new ConnectionManager(
            this.options,
            () => this.connect(url),
            () => this.transport?.disconnect(),
        );

        this.connect(url);
    }

    protected connect(url: string) {
        if (this.transport) {
            this.transport.disconnect();
        }

        this.transport = new ClientTransport(url);

        this.transport.onStatusChange((status) => {
            this.updateStatus(status);
            if (status === 'open') {
                this.connectionManager.reset();
                // Re-subscribe to all active channels
                this.activeSubscriptions.forEach((channel) => {
                    this.send({ type: 'signal', signal: 'subscribe', channel });
                });
            } else if (status === 'closed') {
                this.connectionManager.handleDisconnect();
            }
        });

        this.transport.onMessage((data) => {
            this.dispatcher.processRaw(data);
        });

        this.transport.onError((err) => {
            console.error('Tunnel WebSocket error:', err);
        });
    }

    protected updateStatus(newStatus: Client['status']) {
        this.status = newStatus;
        this.statusListeners.forEach((l) => l(newStatus));
    }

    onStatusChange(callback: (status: Client['status']) => void) {
        this.statusListeners.add(callback);
        return () => {
            this.statusListeners.delete(callback);
        };
    }

    onMessage(callback: (message: any, sender?: any) => void) {
        this.dispatcher.onMessage(callback);
    }

    subscribe(channel: string) {
        this.activeSubscriptions.add(channel);
        this.send({ type: 'signal', signal: 'subscribe', channel });
    }

    unsubscribe(channel: string) {
        this.activeSubscriptions.delete(channel);
        this.send({ type: 'signal', signal: 'unsubscribe', channel });
    }

    /**
     * Create a new channel directly from the client.
     * This automatically binds the channel to this client instance.
     */
    createChannel<T>(name: string): Channel<T> {
        return new Channel<T>({ tunnel: this, name });
    }

    send(message: TunnelMessage) {
        const payload = JSON.stringify(message);
        if (this.status === 'open') {
            this.transport.send(payload);
        } else {
            // Wait for next 'open' status if not currently connected
            const unbind = this.onStatusChange((status) => {
                if (status === 'open') {
                    this.transport.send(payload);
                    unbind();
                }
            });
        }
    }

    disconnect() {
        this.connectionManager.destroy();
        this.updateStatus('closed');
    }
}
