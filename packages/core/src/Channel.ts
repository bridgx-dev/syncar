import type { TunnelBase, TunnelChannelOptions } from './types';

export class Channel<T = any> {
    tunnel?: TunnelBase;
    name: string;
    dynamic?: boolean;
    protected listeners: Set<(data: T) => void> = new Set();

    constructor(options: TunnelChannelOptions) {
        this.tunnel = options.tunnel;
        this.name = options.name;
        this.dynamic = options.dynamic;

        if (this.tunnel) {
            this.setupListener();
        }
    }

    /**
     * Bind this channel to a tunnel instance.
     * This is useful for shared channel definitions.
     */
    bind(tunnel: TunnelBase) {
        if (this.tunnel) return;
        this.tunnel = tunnel;
        this.setupListener();
    }

    protected setupListener() {
        if (!this.tunnel) return;
        this.tunnel.onMessage((message) => {
            if (message.channel === this.name) {
                this.listeners.forEach((cb) => cb(message.data));
            }
        });
    }

    send(data: T) {
        if (!this.tunnel) {
            throw new Error(`Tunnel Error: Channel "${this.name}" is not bound to a tunnel.`);
        }
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
