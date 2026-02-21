export enum MessageType {
  DATA = 'data',
  SIGNAL = 'signal',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export enum SignalType {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
}

export interface IMessage<T = any> {
  type: MessageType
  channel?: string
  data?: T
  signal?: SignalType
}

export interface DataMessage<T = any> extends IMessage<T> {
  type: MessageType.DATA
  channel: string
  data: T
}

export interface SignalMessage extends IMessage {
  type: MessageType.SIGNAL
  channel: string
  signal: SignalType
}

export interface ErrorMessage extends IMessage {
  type: MessageType.ERROR
  data: {
    message: string
    code?: string
    [key: string]: any
  }
}

export interface HeartbeatMessage extends IMessage {
  type: MessageType.HEARTBEAT
}

export type SynnelMessage =
  | DataMessage
  | SignalMessage
  | ErrorMessage
  | HeartbeatMessage
