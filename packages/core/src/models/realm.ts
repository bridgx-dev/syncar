import type { IClient } from './client.ts'

const defaultGenerateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).substring(2, 11)
}

export interface IRealm {
  getClientsIds(): string[]
  getClientById(clientId: string): IClient | undefined
  setClient(client: IClient, id: string): void
  removeClientById(id: string): boolean
  generateClientId(generateClientId?: () => string): string
}

export class Realm implements IRealm {
  private readonly clients = new Map<string, IClient>()

  public getClientsIds(): string[] {
    return [...this.clients.keys()]
  }

  public getClientById(clientId: string): IClient | undefined {
    return this.clients.get(clientId)
  }

  public setClient(client: IClient, id: string): void {
    this.clients.set(id, client)
  }

  public removeClientById(id: string): boolean {
    const client = this.getClientById(id)

    if (!client) return false

    this.clients.delete(id)

    return true
  }

  public generateClientId(generateClientId?: () => string): string {
    const generateId = generateClientId ? generateClientId : defaultGenerateId

    let clientId = generateId()

    while (this.getClientById(clientId)) {
      clientId = generateId()
    }

    return clientId
  }
}
