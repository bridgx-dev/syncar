import { MessageType, type IMessage } from './message'

import type { IRealm } from './realm'
import type { IClient } from './client'
import type { Dispatcher } from '../Dispatcher'
import type { ISubscriptionManager } from './subscribe'

export interface ITransport {
  send(data: any): void
  receive(callback: (data: any, client: IClient) => void): () => void
}

export class TransportManager {
  constructor(
    private readonly realm: IRealm,
    private readonly subscriptionManager: ISubscriptionManager,
    private readonly dispatcher: Dispatcher,
  ) {}

  /**
   * One-to-Many: Sends a message to all subscribers of a specific group/channel.
   */
  public multicast(name: string): ITransport {
    this.subscriptionManager.getOrCreateChannel(name)
    return {
      send: (data: any) => {
        const subscribers = this.subscriptionManager.getSubscribers(name)
        const message: IMessage = {
          channel: name,
          type: MessageType.DATA,
          data,
        }

        subscribers.forEach((id) => {
          const client = this.realm.getClientById(id)
          client?.send(message)
        })
      },
      receive: (callback) => {
        return this.dispatcher.onMessage((message, client) => {
          if (message.channel === name) {
            callback(message.data, client)
          }
        })
      },
    }
  }

  /**
   * One-to-One: Sends a message directly to a specific client by their ID.
   */
  public unicast(clientId: string): ITransport {
    return {
      send: (data: any) => {
        const client = this.realm.getClientById(clientId)
        if (client) {
          client.send({
            data: data,
            type: MessageType.DATA,
          })
        }
      },
      receive: (callback) => {
        return this.dispatcher.onMessage((message, client) => {
          // Listen for messages FROM this specific client
          if (client && client.getId() === clientId) {
            callback(message.data, client)
          }
        })
      },
    }
  }

  /**
   * One-to-All: Sends a message to every connected client in the realm.
   */
  public broadcast(): ITransport {
    return {
      send: (data: any) => {
        const allIds = this.realm.getClientsIds()
        const message: IMessage = {
          channel: 'broadcast',
          type: MessageType.DATA,
          data,
        }

        allIds.forEach((id: string) => {
          const client = this.realm.getClientById(id)
          client?.send(message)
        })
      },
      receive: (callback) => {
        return this.dispatcher.onMessage((message, client) => {
          if (message.channel === name) {
            callback(message.data, client)
          }
        })
      },
    }
  }
}
