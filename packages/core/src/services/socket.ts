import { EventEmitter } from 'node:events'
import { WebSocketServer as Server, WebSocket } from 'ws'
import type { Server as HttpServer, IncomingMessage } from 'node:http'

import { Client } from '../models/client'
import type { IRealm } from '../models/realm'

// 1. Declaration Merging to fix 'isAlive' typing
declare module 'ws' {
  interface WebSocket {
    isAlive: boolean
  }
}

export type SocketServerOptions = {
  server: HttpServer
  realm: IRealm
  path?: string // 2. Add path option
}

export class WebsocketServer extends EventEmitter {
  private socketServer: Server
  private realm: IRealm
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor({ server, realm, path = '/' }: SocketServerOptions) {
    super()
    this.realm = realm

    // 2. Restrict to specific path
    this.socketServer = new Server({ server, path })

    this.socketServer.on('connection', (socket, req) => {
      this._onConnection(socket, req)
    })

    this.socketServer.on('error', (error) => {
      this.emit('error', error)
    })

    this._setupHeartbeat()
  }

  private _setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // socketServer.clients returns a Set<WebSocket>, so we need to cast or iterate carefully
      this.socketServer.clients.forEach((socket) => {
        if (socket.isAlive === false) return socket.terminate()

        socket.isAlive = false
        socket.ping()
      })
    }, 30000)

    this.socketServer.on('close', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval)
      }
    })
  }

  private _onConnection(socket: WebSocket, req: IncomingMessage) {
    // 1. No more 'as any' needed
    socket.isAlive = true
    socket.on('pong', () => {
      socket.isAlive = true
    })

    // 3. Handle individual socket errors without crashing the server
    socket.on('error', (error) => {
      // Log it or handle specific cleanup
      // Emitting to the main server might be noisy/dangerous if unhandled
      console.error('Socket error:', error)
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

    const token = id
    const newClient = new Client({ id, socket, token })
    this.realm.setClient(newClient, id)

    this.emit('connection', newClient)

    socket.on('close', () => {
      // Race condition check: Ensure we are removing the specific client instance
      // that owns this socket.
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
        // 4. Handle invalid JSON gracefully
        console.error('Invalid JSON received')
        socket.send(
          JSON.stringify({ type: 'ERROR', message: 'Invalid JSON format' }),
        )
      }
    })
  }
}
