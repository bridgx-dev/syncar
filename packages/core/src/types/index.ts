import type { WebSocket as WSWebSocket } from 'ws';

export type TunnelOptions = {
    port?: number;
    host?: string;
    server?: any;
    storage?: 'memory' | 'redis' | TunnelStore;
    redisOptions?: any; // node-redis Options
};

export type ClientOptions = {
    url?: string;
    port?: number;
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
};

export type TunnelChannelOptions = {
    tunnel?: TunnelBase;
    name: string;
    dynamic?: boolean;
};

export interface TunnelMessage {
    type?: 'data' | 'signal';
    channel: string;
    data?: any;
    signal?: 'subscribe' | 'unsubscribe';
}

/**
 * Storage Interface for managing both clients and room memberships.
 */
export interface TunnelStore {
    // Client Management
    registerClient(clientId: string, socket: any): Promise<void>;
    unregisterClient(clientId: string): Promise<void>;
    getClient(clientId: string): Promise<any | null>;
    getAllClients(): Promise<Map<string, any>>;

    // Room/Channel Management
    subscribe(clientId: string, channel: string): Promise<void>;
    unsubscribe(clientId: string, channel: string): Promise<void>;
    getSubscribers(channel: string): Promise<Set<string>>;
    getClientRooms(clientId: string): Promise<Set<string>>;
    ready: Promise<void>;
}

export abstract class TunnelBase {
    abstract wsServer?: any;
    abstract wsClient?: any;
    abstract status: 'connecting' | 'open' | 'closed';
    abstract onMessage(callback: (message: any, sender?: WSWebSocket) => void): void;
    abstract send(message: any): void;
    abstract createChannel<T>(name: string): any;
    abstract disconnect(): void;
}
