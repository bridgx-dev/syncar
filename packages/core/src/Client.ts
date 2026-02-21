import { Dispatcher } from './Dispatcher'
import { ConnectionManager } from './ConnectionManager'
import type { ClientOptions, ClientBase, IChannelSubscription } from './types'
import { MessageType, SignalType, type IMessage } from './models/message'

export * from './types'
export { MessageType, SignalType, type IMessage } from './models/message'

export class Client implements ClientBase {
  id: string
  status: 'connecting' | 'open' | 'closed' = 'connecting'
  protected socket?: WebSocket
  protected connectionManager: ConnectionManager
  protected dispatcher = new Dispatcher()
  protected statusListeners: Set<(status: Client['status']) => void> = new Set()
  protected options: ClientOptions
  protected activeSubscriptions: Set<string> = new Set()
  protected callbacks: Map<string, Set<(data: any) => void>> = new Map()
  protected errors: Map<string, Set<(error: any) => void>> = new Map()

  constructor(
    options: ClientOptions = {
      url: `ws://${window.location.hostname}:3000`,
    },
  ) {
    this.options = {
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: Infinity,
      ...options,
    }
    this.id = this.options.id || Math.random().toString(36).substring(2, 11)
    const url = this.options.url!
    this.connectionManager = new ConnectionManager(
      this.options,
      () => this.connect(url),
      () => this.disconnectSocket(),
    )

    this.onMessage((message) => {
      if (message.channel) {
        if (message.type === MessageType.DATA) {
          const callbacks = this.callbacks.get(message.channel)
          if (callbacks) {
            callbacks.forEach((cb) => cb(message.data))
          }
        } else if (message.type === MessageType.ERROR) {
          const errorCallbacks = this.errors.get(message.channel)
          if (errorCallbacks) {
            errorCallbacks.forEach((cb) => cb(message.data))
          }
        }
      }
    })

    this.connect(url)
  }

  protected disconnectSocket() {
    if (this.socket) {
      this.socket.onopen = null
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      this.socket.close()
      this.socket = undefined
    }
  }

  protected connect(url: string) {
    this.disconnectSocket()

    const separator = url.includes('?') ? '&' : '?'
    const connectionUrl = `${url}${separator}id=${encodeURIComponent(this.id)}`

    this.socket = new WebSocket(connectionUrl)
    this.updateStatus('connecting')

    this.socket.onopen = () => {
      this.updateStatus('open')
      this.connectionManager.reset()
      // Re-subscribe to all active channels
      this.activeSubscriptions.forEach((channel) => {
        this.send({
          type: MessageType.SIGNAL,
          signal: SignalType.SUBSCRIBE,
          channel,
        })
      })
    }

    this.socket.onclose = () => {
      this.updateStatus('closed')
      this.connectionManager.handleDisconnect()
    }

    this.socket.onerror = (err) => {
      console.error('Synnel WebSocket error:', err)
      this.updateStatus('closed')
      this.connectionManager.handleDisconnect()
    }

    this.socket.onmessage = (event) => {
      this.dispatcher.processRaw(event.data)
    }
  }

  protected updateStatus(newStatus: Client['status']) {
    this.status = newStatus
    this.statusListeners.forEach((l) => l(newStatus))
  }

  onStatusChange(callback: (status: Client['status']) => void) {
    this.statusListeners.add(callback)
    return () => {
      this.statusListeners.delete(callback)
    }
  }

  onMessage(callback: (message: IMessage, sender?: any) => void) {
    return this.dispatcher.onMessage(callback)
  }

  protected addChannelCallback(channel: string, callback: (data: any) => void) {
    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, new Set())
    }
    const callbacks = this.callbacks.get(channel)!
    callbacks.add(callback)

    this.syncChannelSubscription(channel)
    return () => this.removeChannelCallback(channel, callback)
  }

  protected removeChannelCallback(
    channel: string,
    callback: (data: any) => void,
  ) {
    const callbacks = this.callbacks.get(channel)
    if (callbacks) {
      callbacks.delete(callback)
      this.syncChannelSubscription(channel)
    }
  }

  protected addChannelErrorCallback(
    channel: string,
    callback: (error: any) => void,
  ) {
    if (!this.errors.has(channel)) {
      this.errors.set(channel, new Set())
    }
    const callbacks = this.errors.get(channel)!
    callbacks.add(callback)

    this.syncChannelSubscription(channel)
    return () => this.removeChannelErrorCallback(channel, callback)
  }

  protected removeChannelErrorCallback(
    channel: string,
    callback: (error: any) => void,
  ) {
    const callbacks = this.errors.get(channel)
    if (callbacks) {
      callbacks.delete(callback)
      this.syncChannelSubscription(channel)
    }
  }

  protected syncChannelSubscription(channel: string) {
    const dataCount = this.callbacks.get(channel)?.size || 0
    const errorCount = this.errors.get(channel)?.size || 0
    const hasListeners = dataCount + errorCount > 0

    if (hasListeners && !this.activeSubscriptions.has(channel)) {
      this.activeSubscriptions.add(channel)
      this.send({
        type: MessageType.SIGNAL,
        signal: SignalType.SUBSCRIBE,
        channel,
      })
    } else if (!hasListeners && this.activeSubscriptions.has(channel)) {
      this.unsubscribe(channel)
    }
  }

  subscribe(channel: string): IChannelSubscription {
    const self = this
    const unbinds: Set<() => void> = new Set()

    const unsubscribe = () => {
      unbinds.forEach((unbind) => unbind())
      unbinds.clear()
    }

    const sub = Object.assign(unsubscribe, {
      onMessage(callback: (data: any) => void) {
        unbinds.add(self.addChannelCallback(channel, callback))
        return sub
      },
      onError(callback: (error: any) => void) {
        unbinds.add(self.addChannelErrorCallback(channel, callback))
        return sub
      },
    }) as IChannelSubscription

    return sub
  }

  unsubscribe(channel: string) {
    this.callbacks.delete(channel)
    this.errors.delete(channel)
    this.activeSubscriptions.delete(channel)
    this.send({
      type: MessageType.SIGNAL,
      signal: SignalType.UNSUBSCRIBE,
      channel,
    })
  }

  send(message: IMessage) {
    const payload = JSON.stringify(message)
    if (this.status === 'open' && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload)
    } else {
      // Wait for next 'open' status if not currently connected
      const unbind = this.onStatusChange((status) => {
        if (status === 'open' && this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(payload)
          unbind()
        }
      })
    }
  }

  disconnect() {
    this.connectionManager.destroy()
    this.updateStatus('closed')
  }
}
