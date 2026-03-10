import { useState } from 'react'
import { SyncarProvider } from '@syncar/react'
import { createSyncarClient } from '@syncar/client'
import { WebSocketClientTransport } from '@syncar/client'
import Login from './components/Login'
import Chat from './components/Chat'
import Notifications from './components/Notifications'

export type Notification = {
    id: string
    type: 'info' | 'success' | 'warning'
    message: string
}

// Create client outside component to prevent multiple instances in React StrictMode
const client = createSyncarClient({
    transport: new WebSocketClientTransport({
        url: 'ws://localhost:3001/syncar',
    }),
    autoConnect: true,
})

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

    return (
        <SyncarProvider client={client}>
            <div className="app">
                <Notifications notifications={notifications} />

                {!isLoggedIn ? (
                    <Login onLogin={handleLogin} />
                ) : (
                    <Chat
                        username={username}
                        onNotification={addNotification}
                    />
                )}
            </div>
        </SyncarProvider>
    )
}

export default App
