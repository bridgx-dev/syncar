import type { BaseTransport } from '../types';

export class ClientTransport implements BaseTransport {
    protected socket?: WebSocket;
    status: 'connecting' | 'open' | 'closed' = 'connecting';
    protected onMessageCb?: (data: string) => void;
    protected onStatusChangeCb?: (status: 'connecting' | 'open' | 'closed') => void;
    protected onErrorCb?: (err: any) => void;

    constructor(protected url: string) {
        this.connect();
    }

    protected connect() {
        this.socket = new WebSocket(this.url);
        this.updateStatus('connecting');

        this.socket.onopen = () => this.updateStatus('open');
        this.socket.onclose = () => this.updateStatus('closed');
        this.socket.onerror = (err) => {
            if (this.onErrorCb) this.onErrorCb(err);
            this.updateStatus('closed');
        };
        this.socket.onmessage = (event) => {
            if (this.onMessageCb) this.onMessageCb(event.data);
        };
    }

    protected updateStatus(newStatus: 'connecting' | 'open' | 'closed') {
        this.status = newStatus;
        if (this.onStatusChangeCb) this.onStatusChangeCb(newStatus);
    }

    send(message: string) {
        if (this.socket?.readyState === 1) {
            this.socket.send(message);
        }
    }

    onMessage(callback: (data: string) => void) {
        this.onMessageCb = callback;
    }

    onStatusChange(callback: (status: 'connecting' | 'open' | 'closed') => void) {
        this.onStatusChangeCb = callback;
    }

    onError(callback: (err: any) => void) {
        this.onErrorCb = callback;
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}
