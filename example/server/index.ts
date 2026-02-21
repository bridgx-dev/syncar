import express from 'express'
import { Synnel } from '@synnel/core'
import type { ChatMessage } from '../tunnel'

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Hello Synnel!' })
})

const server = app.listen(3000, () => {
  console.log('Server is running on port 3000 (Combined Express + WebSocket)')
})

// Create the backend Synnel instance
const synnel = new Synnel({ server, path: '/ws' })

// In-memory message store for the chat channel
const chatHistory: ChatMessage[] = []

// Use the multicast transport for the 'chat' channel
const chat = synnel.multicast('chat')

// Listen for messages on the 'chat' channel using the transport API
chat.receive((data: ChatMessage) => {
  // Save to history
  chatHistory.push(data)
  console.log('Received chat message:', data)

  // Keep history size reasonable
  if (chatHistory.length > 50) chatHistory.shift()
})
