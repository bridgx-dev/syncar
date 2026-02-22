import { useState } from 'react'
import { SynnelProvider } from '@synnel/react-v2'
import { WebSocketClientTransport } from '@synnel/adapter-ws-v2'
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

  // Create client transport
  const transport = new WebSocketClientTransport({ url: 'ws://localhost:3001' })

  return (
    <SynnelProvider transport={transport}>
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
