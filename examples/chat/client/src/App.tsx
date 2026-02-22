import { useState, useMemo } from 'react'
import { SynnelProvider } from '@synnel/react'
import { createSynnelClient } from '@synnel/client'
import { WebSocketClientTransport } from '@synnel/adapter-ws'
import Login from './components/Login'
import Chat from './components/Chat'
import Notifications from './components/Notifications'

export type Notification = {
  id: string
  type: 'info' | 'success' | 'warning'
  message: string
}

function App() {
  const [username, setUsername] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (type: Notification['type'], message: string) => {
    const id = Date.now().toString()
    setNotifications((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 5000)
  }

  const handleLogin = (name: string) => {
    setUsername(name)
    setIsLoggedIn(true)
  }

  // Create client
  const client = useMemo(
    () =>
      createSynnelClient({
        transport: new WebSocketClientTransport({ url: 'ws://localhost:3001' }),
        autoConnect: true,
      }),
    [],
  )

  return (
    <SynnelProvider client={client}>
      <div className="app">
        <Notifications notifications={notifications} />

        {!isLoggedIn ? (
          <Login onLogin={handleLogin} />
        ) : (
          <Chat username={username} onNotification={addNotification} />
        )}
      </div>
    </SynnelProvider>
  )
}

export default App
