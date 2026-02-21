export interface IChannel {
  name: string
  subscribers: Set<string>
  subscribe(clientId: string): void
  unsubscribe(clientId: string): void
  hasSubscriber(clientId: string): boolean
  isEmpty(): boolean
}

export class Channel implements IChannel {
  public name: string
  public subscribers: Set<string> = new Set()

  constructor(name: string) {
    this.name = name
  }

  public subscribe(clientId: string): void {
    this.subscribers.add(clientId)
  }

  public unsubscribe(clientId: string): void {
    this.subscribers.delete(clientId)
  }

  public hasSubscriber(clientId: string): boolean {
    return this.subscribers.has(clientId)
  }

  public isEmpty(): boolean {
    return this.subscribers.size === 0
  }
}
