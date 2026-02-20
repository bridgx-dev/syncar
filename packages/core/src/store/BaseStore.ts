import type { TunnelStore } from '../types';

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
