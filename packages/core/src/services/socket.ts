import { EventEmitter } from 'node:events'
import { WebSocketServer as Server } from 'ws'

import type WebSocket from 'ws'
import type { Server as HttpServer, IncomingMessage } from 'node:http'

import { Client } from '../models/client'
import type { IRealm } from '../models/realm'

export type SocketServerOptions = {
  server: HttpServer
  realm: IRealm
}

export class WebsocketServer extends EventEmitter {
  private socketServer: Server
  private realm: IRealm
  private heartbeatInterval: any

  constructor({ server, realm }: SocketServerOptions) {
    super()
    this.realm = realm
    this.socketServer = new Server({ server })
    this.socketServer.on('connection', async (socket, req) => {
      this._onConnection(socket, req)
    })
    this.socketServer.on('error', (error) => {
      this._onSocketError(error)
    })

    this._setupHeartbeat()
  }

  private _setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.socketServer.clients.forEach((socket: any) => {
        if (socket.isAlive === false) return socket.terminate()

        socket.isAlive = false
        socket.ping()
      })
    }, 30000)

    this.socketServer.on('close', () => {
      clearInterval(this.heartbeatInterval)
    })
  }

  private _onConnection(socket: WebSocket, req: IncomingMessage) {
    ;(socket as any).isAlive = true
    socket.on('pong', () => {
      ;(socket as any).isAlive = true
    })

    socket.on('error', (error) => {
      this._onSocketError(error)
    })

    const { searchParams } = new URL(req.url ?? '', 'http://localhost')
    const id = searchParams.get('id')

    if (!id) {
      socket.send(JSON.stringify({ type: 'ERROR', message: 'ID is mandatory' }))
      socket.close()
      return
    }

    if (this.realm.getClientById(id)) {
      socket.send(
        JSON.stringify({ type: 'ID-TAKEN', message: 'ID is already taken' }),
      )
      socket.close()
      return
    }

    const token = id // Default token to ID if not used
    const newClient = new Client({ id, socket, token })
    this.realm.setClient(newClient, id)

    socket.on('close', () => {
      if (newClient.getSocket() === socket) {
        this.realm.removeClientById(newClient.getId())
        this.emit('close', newClient)
      }
    })

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        this.emit('message', newClient, message)
      } catch (e) {
        this.emit('error', e)
      }
    })

    this.emit('connection', newClient)
  }

  private _onSocketError(error: Error): void {
    // handle error
    this.emit('error', error)
  }
}
