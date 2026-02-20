import type { BaseServerTransport, TunnelOptions } from '../types';

export class NodeWSTransport implements BaseServerTransport {
    protected wsServer?: any;
    protected onConnectionCb?: (client: any) => void;
    protected onMessageCb?: (client: any, data: string) => void;
    protected onCloseCb?: (client: any) => void;

    async listen(options: TunnelOptions) {
        const { WebSocketServer } = await import('ws');
        this.wsServer = new WebSocketServer(
            options.server ? { server: options.server } : { port: options.port || 3000 },
        );

        this.wsServer.on('connection', (socket: any) => {
            if (this.onConnectionCb) this.onConnectionCb(socket);

            socket.on('message', (data: any) => {
                if (this.onMessageCb) this.onMessageCb(socket, data.toString());
            });

            socket.on('close', () => {
                if (this.onCloseCb) this.onCloseCb(socket);
            });
        });
    }

    onConnection(callback: (client: any) => void) {
        this.onConnectionCb = callback;
    }

    onMessage(callback: (client: any, data: string) => void) {
        this.onMessageCb = callback;
    }

    onClose(callback: (client: any) => void) {
        this.onCloseCb = callback;
    }

    send(client: any, data: string) {
        if (client.readyState === 1) {
            client.send(data);
        }
    }

    close() {
        if (this.wsServer) {
            this.wsServer.close();
        }
    }

    get clients() {
        return this.wsServer?.clients || [];
    }
}

export { NodeWSTransport as ServerTransport };
