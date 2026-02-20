import type { WebSocket as WSWebSocket } from 'ws';
import type { ClientOptions, TunnelMessage, TunnelBase } from './types';
import { Channel } from './Channel';

export class Client implements TunnelBase {
    wsClient?: WebSocket;
    status: 'connecting' | 'open' | 'closed' = 'connecting';
    protected statusListeners: Set<(status: Client['status']) => void> = new Set();
    protected callbacks: Set<(message: any, sender?: WSWebSocket) => void> = new Set();
    protected options: ClientOptions;
    protected url: string;
    protected reconnectTimer?: any;
    protected attemptCount = 0;
    protected isExplicitlyDisconnected = false;

    constructor(options: ClientOptions = {}) {
        this.options = {
            reconnect: true,
            reconnectInterval: 1000,
            maxReconnectAttempts: Infinity,
            ...options,
        };
        this.url =
            this.options.url || `ws://${window.location.hostname}:${this.options.port || 3000}`;
        this.connect();
    }

    protected connect() {
        if (this.wsClient) {
            this.wsClient.onopen = null;
            this.wsClient.onclose = null;
            this.wsClient.onerror = null;
            this.wsClient.onmessage = null;
            this.wsClient.close();
        }

        this.updateStatus('connecting');
        this.wsClient = new WebSocket(this.url);

        this.wsClient.onopen = () => {
            this.updateStatus('open');
            this.attemptCount = 0;
        };

        this.wsClient.onclose = () => {
            if (this.status !== 'closed') {
                this.updateStatus('closed');
            }
            this.handleReconnect();
        };

        this.wsClient.onerror = (err) => {
            console.error('Tunnel WebSocket error:', err);
            if (this.status !== 'closed') {
                this.updateStatus('closed');
            }
        };

        this.wsClient.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.callbacks.forEach((cb) => cb(message));
            } catch (e) {
                console.error('Failed to parse message', e);
            }
        };
    }

    protected handleReconnect() {
        if (this.isExplicitlyDisconnected || !this.options.reconnect) return;
        if (this.attemptCount >= (this.options.maxReconnectAttempts || Infinity)) {
            console.warn('Max reconnect attempts reached');
            return;
        }

        if (this.reconnectTimer) return;

        const delay = Math.min(
            (this.options.reconnectInterval || 1000) * Math.pow(1.5, this.attemptCount),
            30000, // Max 30s delay
        );

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            this.attemptCount++;
            this.connect();
        }, delay);
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

    onMessage(callback: (message: any, sender?: WSWebSocket) => void) {
        this.callbacks.add(callback);
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
        if (this.status === 'open' && this.wsClient?.readyState === 1) {
            this.wsClient.send(payload);
        } else {
            // Wait for next 'open' status if not currently connected
            const unbind = this.onStatusChange((status) => {
                if (status === 'open' && this.wsClient?.readyState === 1) {
                    this.wsClient.send(payload);
                    unbind();
                }
            });
        }
    }

    disconnect() {
        this.isExplicitlyDisconnected = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = undefined;
            this.updateStatus('closed');
        }
    }
}
