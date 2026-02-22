import { useState, useEffect } from 'react'
import { useSynnelClient } from '@synnel/react-v2'

interface LoginProps {
  onLogin: (username: string) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const client = useSynnelClient()

  useEffect(() => {
    // Handle Enter key
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && username.trim()) {
        onLogin(username.trim())
      }
    }
    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [username, onLogin])

  const getStatusText = () => {
    switch (client.status) {
      case 'connecting':
        return 'Connecting to server...'
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      default:
        return ''
    }
  }

  const getStatusClass = () => {
    switch (client.status) {
      case 'connecting':
        return 'connecting'
      case 'connected':
        return ''
      case 'disconnected':
        return 'disconnected'
      default:
        return 'disconnected'
    }
  }

  return (
    <div className="login">
      <div className="status">
        <span className={`statusDot ${getStatusClass()}`} />
        <span>{getStatusText()}</span>
      </div>
      <h2>Join the Chat</h2>
      <input
        type="text"
        className="loginInput"
        placeholder="Enter your username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
      />
      <button
        className="loginButton"
        onClick={() => username.trim() && onLogin(username.trim())}
        disabled={!username.trim() || client.status !== 'connected'}
      >
        Join Chat
      </button>
    </div>
  )
}
