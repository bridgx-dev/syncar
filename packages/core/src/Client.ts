import { Dispatcher } from './Dispatcher'
import { ConnectionManager } from './ConnectionManager'
import type { ClientOptions, ClientBase, IChannelSubscription } from './types'
import { MessageType, SignalType, type IMessage } from './models/message'

export * from './types'
export { MessageType, SignalType, type IMessage } from './models/message'

export class Client implements ClientBase {
  id: string
  status: 'connecting' | 'open' | 'closed' = 'connecting'
  public options: ClientOptions

  protected socket?: WebSocket
  protected connectionManager: ConnectionManager
  protected dispatcher = new Dispatcher()

  protected statusListeners: Set<(status: Client['status']) => void> = new Set()
  protected activeSubscriptions: Set<string> = new Set()
  protected callbacks: Map<string, Set<(data: any) => void>> = new Map()
  protected errors: Map<string, Set<(error: any) => void>> = new Map()

  // Minimal state for safety
  protected messageQueue: string[] = []
  protected unsubTimers: Map<string, any> = new Map()

  constructor(options?: ClientOptions) {
    // 1. Safe default URL (SSR safe)
    const defaultUrl =
      typeof window !== 'undefined'
        ? `ws://${window.location.hostname}:3000`
        : 'ws://localhost:3000'

    this.options = {
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: Infinity,
      url: defaultUrl,
      ...options,
    }

    this.id = this.options.id || Math.random().toString(36).substring(2, 11)

    this.connectionManager = new ConnectionManager(
      this.options,
      () => this.connect(this.options.url!),
      () => this.disconnectSocket(),
    )

    this.onMessage((message) => {
      if (message.channel) {
        if (message.type === MessageType.DATA) {
          this.callbacks.get(message.channel)?.forEach((cb) => cb(message.data))
        } else if (message.type === MessageType.ERROR) {
          this.errors.get(message.channel)?.forEach((cb) => cb(message.data))
          // If the server rejects a subscription, remove it from active so we don't retry on reconnect
          this.activeSubscriptions.delete(message.channel)
        } else if (message.type === MessageType.SIGNAL) {
          // Handle server acknowledgments
          if (message.signal === SignalType.SUBSCRIBED) {
            this.activeSubscriptions.add(message.channel)
          } else if (message.signal === SignalType.UNSUBSCRIBED) {
            this.activeSubscriptions.delete(message.channel)
          }
        }
      }
    })

    this.connect(this.options.url!)
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

      // Flush offline messages
      while (this.messageQueue.length > 0) {
        this.socket?.send(this.messageQueue.shift()!)
      }

      // Re-subscribe to all active channels
      this.activeSubscriptions.forEach((channel) => {
        this.sendSignal(SignalType.SUBSCRIBE, channel)
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
    if (!this.callbacks.has(channel)) this.callbacks.set(channel, new Set())
    this.callbacks.get(channel)!.add(callback)
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
    if (!this.errors.has(channel)) this.errors.set(channel, new Set())
    this.errors.get(channel)!.add(callback)
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

    // 2. Fix Re-rendering: Clear pending unsubscribe if we add a listener back quickly
    if (this.unsubTimers.has(channel)) {
      clearTimeout(this.unsubTimers.get(channel))
      this.unsubTimers.delete(channel)
    }

    if (hasListeners && !this.activeSubscriptions.has(channel)) {
      this.activeSubscriptions.add(channel)
      this.sendSignal(SignalType.SUBSCRIBE, channel)
    } else if (!hasListeners && this.activeSubscriptions.has(channel)) {
      // 2. Fix Re-rendering: Wait 100ms before actually unsubscribing
      const timer = setTimeout(() => {
        this.unsubscribe(channel)
        this.unsubTimers.delete(channel)
      }, 100)
      this.unsubTimers.set(channel, timer)
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
    this.sendSignal(SignalType.UNSUBSCRIBE, channel)
  }

  protected sendSignal(signal: SignalType, channel: string) {
    // Signals are never queued (to avoid stale state)
    if (this.status === 'open' && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({ type: MessageType.SIGNAL, signal, channel }),
      )
    }
  }

  send(message: IMessage) {
    const payload = JSON.stringify(message)
    if (this.status === 'open' && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload)
    } else {
      // 3. Fix Memory Leak: Use Array instead of Event Listeners
      this.messageQueue.push(payload)
    }
  }

  disconnect() {
    this.connectionManager.destroy()
    this.disconnectSocket()
    this.updateStatus('closed')
    this.messageQueue = []
  }
}
