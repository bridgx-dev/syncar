import { BaseStore } from './BaseStore';

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
            rooms.forEach((channel) => {
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
