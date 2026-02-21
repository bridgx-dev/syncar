import type { IClient } from './client'
import { MessageType, SignalType, type IMessage } from './message'
import { Channel, type IChannel } from './channel'

export interface ISubscriptionManager {
  handleSignal(client: IClient, message: IMessage): Promise<void>
  getSubscribers(channel: string): Set<string>
  removeClient(clientId: string): void
  createChannel(name: string): IChannel
}

export class SubscriptionManager implements ISubscriptionManager {
  private channels = new Map<string, IChannel>()
  private clientChannels = new Map<string, Set<string>>()

  public createChannel(name: string): IChannel {
    let channel = this.channels.get(name)
    if (!channel) {
      channel = new Channel(name)
      this.channels.set(name, channel)
    }
    return channel
  }

  public async handleSignal(client: IClient, message: IMessage): Promise<void> {
    const channelName = message.channel

    if (!channelName) {
      client.send({
        type: MessageType.ERROR,
        data: {
          message: 'Channel name is required for signals.',
          code: 'MISSING_CHANNEL',
        },
      })
      return
    }

    if (message.signal === SignalType.SUBSCRIBE) {
      this.subscribe(client, channelName)
    } else if (message.signal === SignalType.UNSUBSCRIBE) {
      this.unsubscribe(client, channelName)
    } else {
      client.send({
        type: MessageType.ERROR,
        data: {
          message: `Unknown signal type: ${message.signal}`,
          code: 'INVALID_SIGNAL',
        },
      })
    }
  }

  private subscribe(client: IClient, channelName: string): void {
    const clientId = client.getId()
    const channel = this.channels.get(channelName)

    // Prevent dynamic creation: if channel doesn't exist, abort.
    if (!channel) {
      console.warn(
        `Client ${clientId} attempted to subscribe to non-existent channel: ${channelName}`,
      )
      client.send({
        type: MessageType.ERROR,
        channel: channelName,
        data: {
          message: `Channel '${channelName}' not found.`,
          code: 'CHANNEL_NOT_FOUND',
        },
      })
      return
    }

    channel.subscribe(clientId)

    if (!this.clientChannels.has(clientId)) {
      this.clientChannels.set(clientId, new Set())
    }
    this.clientChannels.get(clientId)?.add(channelName)

    client.send({
      type: MessageType.SIGNAL,
      signal: SignalType.SUBSCRIBED,
      channel: channelName,
      data: { message: `Subscribed to '${channelName}' successfully.` },
    })
  }

  private unsubscribe(client: IClient, channelName: string): void {
    const clientId = client.getId()
    const channel = this.channels.get(channelName)
    if (channel) {
      channel.unsubscribe(clientId)
      // Removed auto-delete to give server full control over channel lifecycle
    }
    this.clientChannels.get(clientId)?.delete(channelName)

    client.send({
      type: MessageType.SIGNAL,
      signal: SignalType.UNSUBSCRIBED,
      channel: channelName,
      data: { message: `Unsubscribed from '${channelName}' successfully.` },
    })
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
          // Removed auto-delete to give server full control over channel lifecycle
        }
      })
    }
    this.clientChannels.delete(clientId)
  }
}
