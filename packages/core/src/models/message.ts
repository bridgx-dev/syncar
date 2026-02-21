export enum MessageType {
  DATA = 'data',
  SIGNAL = 'signal',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export enum SignalType {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
}

export interface IMessage<T = any> {
  type: MessageType
  channel: string
  data?: T
  signal?: SignalType
}
