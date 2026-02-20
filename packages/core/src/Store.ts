import type { TunnelStore } from './types';

/**
 * Base Storage Class that can be extended.
 */
export abstract class BaseStore implements TunnelStore {
    abstract registerClient(clientId: string, socket: any): Promise<void>;
    abstract unregisterClient(clientId: string): Promise<void>;
    abstract getClient(clientId: string): Promise<any | null>;
    abstract getAllClients(): Promise<Map<string, any>>;

    abstract subscribe(clientId: string, channel: string): Promise<void>;
    abstract unsubscribe(clientId: string, channel: string): Promise<void>;
    abstract getSubscribers(channel: string): Promise<Set<string>>;
    abstract getClientRooms(clientId: string): Promise<Set<string>>;
    abstract ready: Promise<void>;
}

/**
 * In-Memory Implementation of the Unified Store
 */
export class MemoryStore extends BaseStore {
    protected clients: Map<string, any> = new Map();
    protected rooms: Map<string, Set<string>> = new Map();
    protected clientRooms: Map<string, Set<string>> = new Map();
    ready: Promise<void> = Promise.resolve();

    async registerClient(clientId: string, socket: any) {
        this.clients.set(clientId, socket);
    }

    async unregisterClient(clientId: string) {
        this.clients.delete(clientId);
        const rooms = this.clientRooms.get(clientId);
        if (rooms) {
            rooms.forEach(channel => {
                this.rooms.get(channel)?.delete(clientId);
            });
        }
        this.clientRooms.delete(clientId);
    }

    async getClient(clientId: string) {
        return this.clients.get(clientId) || null;
    }

    async getAllClients() {
        return this.clients;
    }

    async subscribe(clientId: string, channel: string) {
        if (!this.rooms.has(channel)) this.rooms.set(channel, new Set());
        this.rooms.get(channel)?.add(clientId);

        if (!this.clientRooms.has(clientId)) this.clientRooms.set(clientId, new Set());
        this.clientRooms.get(clientId)?.add(channel);
    }

    async unsubscribe(clientId: string, channel: string) {
        this.rooms.get(channel)?.delete(clientId);
        this.clientRooms.get(clientId)?.delete(channel);
    }

    async getSubscribers(channel: string) {
        return this.rooms.get(channel) || new Set();
    }

    async getClientRooms(clientId: string) {
        return this.clientRooms.get(clientId) || new Set();
    }
}

/**
 * Redis implementation of the Unified Store for distributed environments.
 * Note: Sockets are kept in a local Map as they cannot be serialized.
 */
export class RedisStore extends BaseStore {
    protected localClients: Map<string, any> = new Map();
    protected redis: any; // Redis client instance
    protected prefix: string;
    ready: Promise<void>;

    constructor(redisOptions: any, prefix: string = 'tunnel:') {
        super();
        this.prefix = prefix;
        this.ready = this.init(redisOptions);
    }

    protected async init(options: any) {
        const { createClient } = await import('redis');
        this.redis = createClient(options);
        this.redis.on('error', (err: any) => console.error('Redis Client Error', err));
        await this.redis.connect();
    }

    async registerClient(clientId: string, socket: any) {
        this.localClients.set(clientId, socket);
        if (this.redis?.isOpen) {
            await this.redis.sAdd(`${this.prefix}clients`, clientId);
        }
    }

    async unregisterClient(clientId: string) {
        this.localClients.delete(clientId);
        if (this.redis?.isOpen) {
            await this.redis.sRem(`${this.prefix}clients`, clientId);
            
            // Cleanup subscriptions
            const rooms = await this.getClientRooms(clientId);
            for (const room of rooms) {
                await this.unsubscribe(clientId, room);
            }
        }
    }

    async getClient(clientId: string) {
        return this.localClients.get(clientId) || null;
    }

    async getAllClients() {
        return this.localClients;
    }

    async subscribe(clientId: string, channel: string) {
        if (this.redis?.isOpen) {
            await this.redis.sAdd(`${this.prefix}room:${channel}`, clientId);
            await this.redis.sAdd(`${this.prefix}client_rooms:${clientId}`, channel);
        }
    }

    async unsubscribe(clientId: string, channel: string) {
        if (this.redis?.isOpen) {
            await this.redis.sRem(`${this.prefix}room:${channel}`, clientId);
            await this.redis.sRem(`${this.prefix}client_rooms:${clientId}`, channel);
        }
    }

    async getSubscribers(channel: string): Promise<Set<string>> {
        if (this.redis?.isOpen) {
            const members = await this.redis.sMembers(`${this.prefix}room:${channel}`);
            return new Set(members);
        }
        return new Set();
    }

    async getClientRooms(clientId: string): Promise<Set<string>> {
        if (this.redis?.isOpen) {
            const rooms = await this.redis.sMembers(`${this.prefix}client_rooms:${clientId}`);
            return new Set(rooms);
        }
        return new Set();
    }
}
