import type { IClientConnection } from '../types'
import { ClientRegistry } from '../registry'

export class ConnectionHandler {
    private readonly registry: ClientRegistry

    constructor(dependencies: {
        registry: ClientRegistry
    }) {
        this.registry = dependencies.registry
    }

    async handleConnection(connection: IClientConnection): Promise<void> {
        // Register client in registry
        this.registry.register(connection)
    }

    async handleDisconnection(clientId: string): Promise<void> {
        const client = this.registry.get(clientId)

        if (!client) {
            return // Client already unregistered
        }

        // Unregister client
        this.registry.unregister(clientId)
    }
}
