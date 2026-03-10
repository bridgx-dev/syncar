import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useSyncarClient, useChannel, useBroadcast } from '@syncar/react'
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

export default function Chat({ username }: ChatProps) {
    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [typingUsers, setTypingUsers] = useState<string[]>([])
    const [userCount, setUserCount] = useState<number>(0)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const client = useSyncarClient()
    const messageIdsRef = useRef<Set<string>>(new Set())
    const typingTimeoutsRef = useRef<
        Map<string, ReturnType<typeof setTimeout>>
    >(new Map())

    // Subscribe to chat channel with onMessage callback in options
    const chat = useChannel<ChatMessage>('chat', {
        onMessage: (data) => {
            // Prevent duplicate messages by ID
            if (messageIdsRef.current.has(data.id)) {
                return
            }
            messageIdsRef.current.add(data.id)
            setMessages((prev) => [...prev, data])
        },
    })

    const presence = useChannel<{
        userId: string
        username: string
        status: 'online' | 'offline' | 'typing'
    }>('presence', {
        onMessage: (data) => {
            if (data.status === 'typing' && data.username !== username) {
                setTypingUsers((prev) => {
                    if (!prev.includes(data.username)) {
                        return [...prev, data.username]
                    }
                    return prev
                })

                // Clear any existing timeout for this user
                const existingTimeout = typingTimeoutsRef.current.get(
                    data.username,
                )
                if (existingTimeout) {
                    clearTimeout(existingTimeout)
                }

                // Set new timeout and store it
                const timeoutId = setTimeout(() => {
                    setTypingUsers((prev) =>
                        prev.filter((u) => u !== data.username),
                    )
                    typingTimeoutsRef.current.delete(data.username)
                }, 1000) // Remove typing indicator after 1 second of inactivity
                typingTimeoutsRef.current.set(data.username, timeoutId)
            }
        },
    })

    useBroadcast<{ message: string }>({
        onMessage: (data) => {
            console.log(data.message)
            setUserCount(
                data.message.includes('Users online:')
                    ? parseInt(data.message.split(': ')[1])
                    : userCount,
            )
        },
    })

    // Auto-scroll to bottom when new messages arrive
    useLayoutEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Send presence notification when joining
    useEffect(() => {
        presence.send({ userId: client.id, username, status: 'online' })
    }, [presence.send, username, client.id])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear all typing timeouts
            for (const timeout of typingTimeoutsRef.current.values()) {
                clearTimeout(timeout)
            }
            typingTimeoutsRef.current.clear()

            // Clear message IDs to prevent memory leak
            messageIdsRef.current.clear()
        }
    }, [])

    const handleSend = () => {
        if (message.trim()) {
            const newMessage: ChatMessage = {
                id: Date.now().toString(),
                type: 'message',
                text: message.trim(),
                user: username,
                timestamp: Date.now(),
            }

            // Track this message ID to prevent duplicates when we receive it back
            messageIdsRef.current.add(newMessage.id)

            // Send to server
            chat.send(newMessage)

            // Optimistic UI: Add user's own message immediately
            setMessages((prev) => [...prev, newMessage])

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
        // Send typing indicator immediately on input
        if (e.target.value.length > 0) {
            presence.send({ userId: client.id, username, status: 'typing' })
            // Clear any existing timeout
            const existingTimeout = typingTimeoutsRef.current.get(username)
            if (existingTimeout) {
                clearTimeout(existingTimeout)
            }
            // Set a timeout to send 'online' after user stops typing for 1s
            const timeoutId = setTimeout(() => {
                presence.send({ userId: client.id, username, status: 'online' })
                typingTimeoutsRef.current.delete(username)
            }, 1000)
            typingTimeoutsRef.current.set(username, timeoutId)
        } else {
            // If input is cleared, send 'online' immediately
            presence.send({ userId: client.id, username, status: 'online' })
            const existingTimeout = typingTimeoutsRef.current.get(username)
            if (existingTimeout) {
                clearTimeout(existingTimeout)
                typingTimeoutsRef.current.delete(username)
            }
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
                <h1>Syncar v2 Chat</h1>
                <div className="status">
                    <span className="statusDot" />
                    <span>{username}</span>
                    {userCount > 0 && (
                        <span className="userCount">
                            • {userCount} {userCount === 1 ? 'user' : 'users'}{' '}
                            online
                        </span>
                    )}
                </div>
            </div>
            <div className="chat">
                <div className="messages">
                    {messages.length === 0 && (
                        <div className="message system">
                            <div className="messageText">
                                Welcome to the chat! Send a message to start.
                            </div>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`message ${msg.type === 'system' ? 'system' : ''} ${msg.user === username ? 'own' : ''}`}
                        >
                            {msg.type !== 'system' && (
                                <div
                                    className="messageAvatar"
                                    style={{
                                        background: getAvatarColor(msg.user),
                                    }}
                                >
                                    {msg.user[0].toUpperCase()}
                                </div>
                            )}
                            <div className="messageContent">
                                {msg.type !== 'system' && (
                                    <div className="messageName">
                                        {msg.user}
                                    </div>
                                )}
                                <div className="messageText">{msg.text}</div>
                            </div>
                        </div>
                    ))}
                    {typingUsers.length > 0 && (
                        <div className="typingIndicator">
                            {typingUsers.join(', ')}{' '}
                            {typingUsers.length === 1 ? 'is' : 'are'} typing...
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
                    <button
                        className="sendButton"
                        onClick={handleSend}
                        disabled={!message.trim()}
                    >
                        Send
                    </button>
                </div>
            </div>
        </>
    )
}
