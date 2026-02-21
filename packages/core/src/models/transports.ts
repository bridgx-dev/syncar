import { MessageType, type IMessage } from './message'
import type { IRealm } from './realm'
import type { IClient } from './client'
import type { Dispatcher } from '../Dispatcher'
import type { ISubscriptionManager } from './subscribe'

export interface ITransport {
  send(data: any): void
  receive(callback: (data: any, client: IClient) => void): () => void
}

export abstract class BaseTransport implements ITransport {
  constructor(protected readonly dispatcher: Dispatcher) {}
  abstract send(data: any): void
  abstract receive(callback: (data: any, client: IClient) => void): () => void
}

export class MulticastTransport extends BaseTransport {
  constructor(
    private readonly name: string,
    private readonly realm: IRealm,
    private readonly subscriptionManager: ISubscriptionManager,
    dispatcher: Dispatcher,
  ) {
    super(dispatcher)
    if (name.startsWith('__')) {
      throw new Error('Channel names starting with "__" are reserved.')
    }
    // Server creates the channel here upon instantiation
    this.subscriptionManager.createChannel(name)
  }

  send(data: any): void {
    const subscribers = this.subscriptionManager.getSubscribers(this.name)
    const message: IMessage = {
      channel: this.name,
      type: MessageType.DATA,
      data,
    }

    subscribers.forEach((id) => {
      const client = this.realm.getClientById(id)
      client?.send(message)
    })
  }

  receive(callback: (data: any, client: IClient) => void): () => void {
    return this.dispatcher.onMessage((message, client) => {
      if (message.channel === this.name) {
        callback(message.data, client)
      }
    })
  }
}

export class BroadcastTransport extends BaseTransport {
  constructor(
    private readonly realm: IRealm,
    dispatcher: Dispatcher,
  ) {
    super(dispatcher)
  }

  send(data: any): void {
    const allIds = this.realm.getClientsIds()
    const message: IMessage = {
      channel: '__broadcast',
      type: MessageType.DATA,
      data,
    }

    allIds.forEach((id: string) => {
      const client = this.realm.getClientById(id)
      client?.send(message)
    })
  }

  receive(callback: (data: any, client: IClient) => void): () => void {
    // Broadcast is strictly Server-to-Client.
    // Clients cannot send messages to the __broadcast channel.
    console.warn(
      'BroadcastTransport does not support receiving messages from clients.',
    )
    return () => {}
  }
}
