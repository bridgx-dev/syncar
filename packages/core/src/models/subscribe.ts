import type { IClient } from './client'
import type { IMessage } from './message'
import { Channel, type IChannel } from './channel'

export interface ISubscriptionManager {
  handleSignal(client: IClient, message: IMessage): Promise<void>
  getSubscribers(channel: string): Set<string>
  removeClient(clientId: string): void
  getOrCreateChannel(name: string): IChannel
}

export class SubscriptionManager implements ISubscriptionManager {
  private channels = new Map<string, IChannel>()
  private clientChannels = new Map<string, Set<string>>()

  public getOrCreateChannel(name: string): IChannel {
    let channel = this.channels.get(name)
    if (!channel) {
      channel = new Channel(name)
      this.channels.set(name, channel)
    }
    return channel
  }

  public async handleSignal(client: IClient, message: IMessage): Promise<void> {
    const clientId = client.getId()
    const channelName = message.channel

    if (message.signal === 'subscribe') {
      this.subscribe(clientId, channelName)
    } else if (message.signal === 'unsubscribe') {
      this.unsubscribe(clientId, channelName)
    }
  }

  private subscribe(clientId: string, channelName: string): void {
    const channel = this.getOrCreateChannel(channelName)
    channel.subscribe(clientId)

    if (!this.clientChannels.has(clientId)) {
      this.clientChannels.set(clientId, new Set())
    }
    this.clientChannels.get(clientId)?.add(channelName)
  }

  private unsubscribe(clientId: string, channelName: string): void {
    const channel = this.channels.get(channelName)
    if (channel) {
      channel.unsubscribe(clientId)
      if (channel.isEmpty()) {
        this.channels.delete(channelName)
      }
    }
    this.clientChannels.get(clientId)?.delete(channelName)
  }

  public getSubscribers(channelName: string): Set<string> {
    return this.channels.get(channelName)?.subscribers || new Set()
  }

  public removeClient(clientId: string): void {
    const channelNames = this.clientChannels.get(clientId)
    if (channelNames) {
      channelNames.forEach((name) => {
        const channel = this.channels.get(name)
        if (channel) {
          channel.unsubscribe(clientId)
          if (channel.isEmpty()) {
            this.channels.delete(name)
          }
        }
      })
    }
    this.clientChannels.delete(clientId)
  }
}
