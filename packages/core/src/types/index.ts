import type { IMessage } from '../models/message'

export type ClientOptions = {
  id?: string
  url?: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export interface BaseTransport {
  status: 'connecting' | 'open' | 'closed'
  send(message: string): void
  onMessage(callback: (data: string) => void): void
  onStatusChange(
    callback: (status: 'connecting' | 'open' | 'closed') => void,
  ): void
  onError(callback: (err: any) => void): void
  disconnect(): void
}

export interface IChannelSubscription {
  (): void
  onMessage<T = any>(callback: (data: T) => void): IChannelSubscription
  onError(callback: (error: any) => void): IChannelSubscription
}

export abstract class ClientBase {
  abstract onMessage(
    callback: (message: IMessage, sender?: any) => void,
  ): () => void
  abstract send(message: IMessage): void
  abstract subscribe(channel: string): IChannelSubscription
  abstract unsubscribe(channel: string): void
  abstract disconnect(): void
}
