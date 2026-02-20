import type { WebSocket as WSWebSocket } from 'ws';
import type { TunnelOptions, TunnelMessage, TunnelBase } from './types';

export class TunnelClient implements TunnelBase {
    wsServer?: any;
    wsClient?: WebSocket;
    status: 'connecting' | 'open' | 'closed' = 'connecting';
    protected statusListeners: Set<(status: TunnelClient['status']) => void> = new Set();
    protected callbacks: Set<(message: any, sender?: WSWebSocket) => void> = new Set();

    constructor(options: TunnelOptions = {}) {
        const url = options.url || `ws://${window.location.hostname}:${options.port || 3000}`;
        this.wsClient = new WebSocket(url);
        
        this.wsClient.onopen = () => this.updateStatus('open');
        this.wsClient.onclose = () => this.updateStatus('closed');
        this.wsClient.onerror = () => this.updateStatus('closed');
        
        this.wsClient.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.callbacks.forEach((cb) => cb(message));
            } catch (e) {
                console.error('Failed to parse message', e);
            }
        };
    }

    protected updateStatus(newStatus: TunnelClient['status']) {
        this.status = newStatus;
        this.statusListeners.forEach((l) => l(newStatus));
    }

    onStatusChange(callback: (status: TunnelClient['status']) => void) {
        this.statusListeners.add(callback);
        return () => {
            this.statusListeners.delete(callback);
        };
    }

    onMessage(callback: (message: any, sender?: WSWebSocket) => void) {
        this.callbacks.add(callback);
    }

    send(message: TunnelMessage) {
        const payload = JSON.stringify(message);
        if (this.wsClient) {
            if (this.wsClient.readyState === 1) {
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

    disconnect() {
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = undefined;
            this.updateStatus('closed');
        }
    }
}
