import { Realm } from './models/realm'
import { WebsocketServer } from './services/socket'
import { SubscriptionManager } from './models/subscribe'
import { TransportManager, type ITransport } from './models/transport-manager'
import { Dispatcher } from './Dispatcher'

import type { IClient } from './models/client'
import type { IMessage } from './models/message'

// Define options for the constructor
interface SynnelOptions {
  server: any // Node http server
  path?: string // Websocket path (e.g. /ws)
}

export class Synnel {
  private wsServer: WebsocketServer
  private realm: Realm = new Realm()
  private subscriptionManager = new SubscriptionManager()
  private dispatcher: Dispatcher = new Dispatcher()
  private transport: TransportManager

  constructor({ server, path = '/ws' }: SynnelOptions) {
    // Pass the path to the internal WS server
    this.wsServer = new WebsocketServer({ server, realm: this.realm, path })

    this.transport = new TransportManager(
      this.realm,
      this.subscriptionManager,
      this.dispatcher,
    )

    this._setupListeners()
  }

  private _setupListeners() {
    this.wsServer.on('connection', (client: IClient) => {
      // Optional: Send a "Welcome" or "Identify" packet here
    })

    this.wsServer.on('message', async (client: IClient, msg: IMessage) => {
      if (!msg) return

      // FIX 1: Check for signals FIRST.
      // Signals might not have a 'channel' property (e.g. "ping", "auth").
      if (msg.type === 'signal') {
        await this.subscriptionManager.handleSignal(client, msg)
        return
      }

      // FIX 2: Now check for channel requirements for standard messages
      if (!msg.channel) {
        // Optional: Handle direct messages (Unicast) here if targetId exists
        return
      }

      // 2. Dispatch to server-side listeners (receive hooks)
      this.dispatcher.emit(msg, client)

      // 3. Automated Relay to other subscribers
      await this.handleRelay(client, msg)
    })

    this.wsServer.on('close', (client: IClient) => {
      // Clean up subscriptions when user disconnects
      this.subscriptionManager.removeClient(client.getId())
    })
  }

  /**
   * One-to-Many: Target a specific group/channel.
   */
  public multicast(name: string): ITransport {
    return this.transport.multicast(name)
  }

  /**
   * One-to-One: Target a specific client by ID.
   */
  public unicast(clientId: string): ITransport {
    return this.transport.unicast(clientId)
  }

  /**
   * One-to-All: Target every connected client.
   */
  public broadcast(): ITransport {
    return this.transport.broadcast()
  }

  private async handleRelay(client: IClient, message: IMessage): Promise<void> {
    if (!message.channel) return

    const subscribers = this.subscriptionManager.getSubscribers(message.channel)
    const senderId = client.getId()

    // Optimization: If you have 10,000 users, don't iterate one by one.
    // For now (MVP), iteration is fine.
    subscribers.forEach((id: string) => {
      if (id === senderId) return // Don't echo back to sender

      const targetClient = this.realm.getClientById(id)

      // Ensure the client is still connected before sending
      if (targetClient) {
        targetClient.send(message)
      }
    })
  }
}
