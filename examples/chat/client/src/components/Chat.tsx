import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useSynnelClient, useChannel, useBroadcast } from '@synnel/react'
import type { Notification } from '../App'

interface ChatProps {
  username: string
  onNotification: (type: Notification['type'], message: string) => void
}

interface ChatMessage {
  id: string
  type: 'message' | 'system'
  text: string
  user: string
  timestamp: number
}

interface NotificationMessage {
  type: 'info' | 'warning' | 'success'
  message: string
  timestamp: number
}

export default function Chat({ username, onNotification }: ChatProps) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const client = useSynnelClient()

  // Subscribe to chat channel
  const chat = useChannel<ChatMessage>('chat')
  const notifications = useChannel<NotificationMessage>('notifications')
  const presence = useChannel<{ userId: string; username: string; status: 'online' | 'offline' | 'typing' }>('presence')
  const broadcast = useBroadcast<{ announcement: string }>()

  // Auto-scroll to bottom when new messages arrive
  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle incoming chat messages
  useEffect(() => {
    const unsubscribe = chat.onMessage((data, _message) => {
      setMessages((prev) => [...prev, data])
    })
    return unsubscribe
  }, [chat])

  // Handle notifications
  useEffect(() => {
    const unsubscribe = notifications.onMessage((data) => {
      onNotification(data.type, data.message)
    })
    return unsubscribe
  }, [notifications, onNotification])

  // Handle presence (typing indicators)
  useEffect(() => {
    const unsubscribe = presence.onMessage((data) => {
      if (data.status === 'typing' && data.username !== username) {
        setTypingUsers((prev) => {
          if (!prev.includes(data.username)) {
            return [...prev, data.username]
          }
          return prev
        })
        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== data.username))
        }, 3000)
      }
    })
    return unsubscribe
  }, [presence, username])

  // Handle broadcast announcements
  useEffect(() => {
    const unsubscribe = broadcast.onMessage((data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `broadcast-${Date.now()}`,
          type: 'system',
          text: data.announcement,
          user: 'System',
          timestamp: Date.now(),
        },
      ])
    })
    return unsubscribe
  }, [broadcast])

  // Send presence notification when joining
  useEffect(() => {
    presence.send({ userId: client.id, username, status: 'online' })
  }, [presence, username, client.id])

  const handleSend = () => {
    if (message.trim()) {
      chat.send({
        id: Date.now().toString(),
        type: 'message',
        text: message.trim(),
        user: username,
        timestamp: Date.now(),
      })
      setMessage('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value)
    // Send typing indicator
    if (e.target.value.length > 0 && e.target.value.length % 5 === 0) {
      presence.send({ userId: client.id, username, status: 'typing' })
    }
  }

  // Get avatar color based on username
  const getAvatarColor = (username: string) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    ]
    const index = username.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <>
      <div className="header">
        <h1>Synnel v2 Chat</h1>
        <div className="status">
          <span className="statusDot" />
          <span>{username}</span>
        </div>
      </div>
      <div className="chat">
        <div className="messages">
          {messages.length === 0 && (
            <div className="message system">
              <div className="messageText">Welcome to the chat! Send a message to start.</div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.type === 'system' ? 'system' : ''} ${msg.user === username ? 'own' : ''}`}
            >
              {msg.type !== 'system' && (
                <div className="messageAvatar" style={{ background: getAvatarColor(msg.user) }}>
                  {msg.user[0].toUpperCase()}
                </div>
              )}
              <div className="messageContent">
                {msg.type !== 'system' && <div className="messageName">{msg.user}</div>}
                <div className="messageText">{msg.text}</div>
              </div>
            </div>
          ))}
          {typingUsers.length > 0 && (
            <div className="typingIndicator">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="input">
          <input
            type="text"
            className="inputField"
            placeholder="Type a message..."
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <button className="sendButton" onClick={handleSend} disabled={!message.trim()}>
            Send
          </button>
        </div>
      </div>
    </>
  )
}
