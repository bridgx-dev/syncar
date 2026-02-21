import { createServer } from 'node:http'
import { Synnel } from '../Synnel'

const server = createServer()
const tunnel = new Synnel(server)

const chat = tunnel.broadcast('chat')
const privateMsg = tunnel.unicast('client-id-123')
const groupMsg = tunnel.multicast('group-1')

chat.send({ text: 'Hello everyone!' })
chat.receive((message) => {
  console.log('Received chat message:', message)
})

privateMsg.send({ text: 'Hello client-id-123!' })
privateMsg.receive((message) => {
  console.log('Received private message:', message)
})

groupMsg.send({ text: 'Hello group-1 members!' })
groupMsg.receive((message) => {
  console.log('Received group message:', message)
})
