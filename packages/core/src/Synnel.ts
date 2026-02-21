import { Realm } from "./models/realm";
import { WebsocketServer } from "./services/socket";
import { SubscriptionManager } from "./models/subscribe";
import { TransportManager, type ITransport } from "./models/transport-manager";
import { Dispatcher } from "./Dispatcher";

import type { IClient } from "./models/client";
import type { IMessage } from "./models/message";
import type { Server as HttpServer } from "node:http";

export class Synnel {
  private wsServer: WebsocketServer;
  private realm: Realm = new Realm();
  private subscriptionManager = new SubscriptionManager();
  private dispatcher: Dispatcher = new Dispatcher();
  private transport: TransportManager;

  constructor(server: HttpServer) {
    this.wsServer = new WebsocketServer({ server, realm: this.realm });
    this.transport = new TransportManager(
      this.realm,
      this.subscriptionManager,
      this.dispatcher,
    );

    this.wsServer.on("connection", (_client: IClient) => {
      // Logic for new connections
    });

    this.wsServer.on("message", async (client: IClient, msg: IMessage) => {
      if (!msg || !msg.channel) return;

      // 1. Handle signals (subscriptions/unsubscriptions)
      if (msg.type === "signal") {
        await this.subscriptionManager.handleSignal(client, msg as any);
        return;
      }

      // 2. Dispatch to server-side listeners (receive hooks)
      this.dispatcher.emit(msg, client);

      // 3. Automated Relay to other subscribers
      await this.handleRelay(client, msg);
    });

    this.wsServer.on("close", (client: IClient) => {
      this.subscriptionManager.removeClient(client.getId());
    });
  }

  /**
   * One-to-Many: Target a specific group/channel.
   */
  public multicast(name: string): ITransport {
    return this.transport.multicast(name);
  }

  /**
   * One-to-One: Target a specific client by ID.
   */
  public unicast(clientId: string): ITransport {
    return this.transport.unicast(clientId);
  }

  /**
   * One-to-All: Target every connected client.
   */
  public broadcast(name: string = "global"): ITransport {
    return this.transport.broadcast(name);
  }

  private async handleRelay(client: IClient, message: IMessage): Promise<void> {
    // Targeted Relay (Broadcast to subscribers of the channel)
    if (!message.channel) return;
    const subscribers = this.subscriptionManager.getSubscribers(
      message.channel,
    );

    const clientId = client.getId();
    subscribers.forEach((id: string) => {
      // Don't send back to the sender
      if (id === clientId) return;

      const targetClient = this.realm.getClientById(id);
      if (targetClient) {
        targetClient.send(message);
      }
    });
  }
}
