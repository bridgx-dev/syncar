import { useState, useEffect } from 'react'
import type { ChatMessage } from '../tunnel'
import { useChannel } from '@synnel/react'

export const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const {
    data: incomingMessage,
    send,
    error,
    status,
  } = useChannel<ChatMessage>('chat')
  const [inputText, setInputText] = useState('')

  useEffect(() => {
    if (incomingMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages((prev) => [...prev, incomingMessage])
    }
  }, [incomingMessage])

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const newMessage: ChatMessage = {
      user: 'Guest',
      text: inputText,
      timestamp: Date.now(),
    }

    send(newMessage)
    setMessages((prev) => [...prev, newMessage])
    setInputText('')
  }

  return (
    <div
      className="chat-container"
      style={{
        marginTop: '20px',
        padding: '15px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        opacity: status === 'closed' ? 0.6 : 1,
      }}
    >
      <h3>Real-time Tunnel Chat</h3>
      {error && (
        <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>
          Error: {error.message}
        </div>
      )}
      <div
        className="messages"
        style={{
          height: '150px',
          overflowY: 'auto',
          marginBottom: '10px',
          textAlign: 'left',
        }}
      >
        {messages?.map((msg, i) => (
          <div key={i} style={{ marginBottom: '5px' }}>
            <strong>{msg.user}:</strong> {msg.text}
          </div>
        ))}
        {!messages?.length && <p>No messages yet...</p>}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '5px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '5px' }}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
