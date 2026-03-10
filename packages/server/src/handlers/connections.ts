import type { IClientConnection } from '../types'
import { ClientRegistry } from '../registry'
import { CLOSE_CODES } from '../config'

export interface ConnectionHandlerOptions {
    rejectionCloseCode?: number
}

export class ConnectionHandler {
    private readonly registry: ClientRegistry
    private readonly options: Required<ConnectionHandlerOptions>

    constructor(dependencies: {
        registry: ClientRegistry
        options?: ConnectionHandlerOptions
    }) {
        this.registry = dependencies.registry

        // Apply defaults
        this.options = {
            rejectionCloseCode:
                dependencies.options?.rejectionCloseCode ??
                CLOSE_CODES.REJECTED,
        }
    }

    async handleConnection(
        connection: IClientConnection,
    ): Promise<IClientConnection> {
        // Register client in registry
        const client = this.registry.register(connection)
        return client
    }

    async handleDisconnection(
        clientId: string,
        _reason?: string,
    ): Promise<void> {
        const client = this.registry.get(clientId)

        if (!client) {
            return // Client already unregistered
        }

        // Unregister client
        this.registry.unregister(clientId)
    }

    getOptions(): Readonly<Required<ConnectionHandlerOptions>> {
        return this.options
    }
}
