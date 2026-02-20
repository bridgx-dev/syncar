import { useState } from 'react';
import type { ChatMessage } from '../tunnel';
import { useChannel } from '@tunnel/react';

export const Chat = () => {
    const { data: messages, send } = useChannel<ChatMessage[]>('chat');
    const [inputText, setInputText] = useState('');

    const sendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const newMessage: ChatMessage = {
            user: 'Guest',
            text: inputText,
            timestamp: Date.now(),
        };

        // If 'data' is null, we start with an empty array
        const updatedMessages = [...(messages || []), newMessage];

        send(updatedMessages);
        setInputText('');
    };

    return (
        <div
            className='chat-container'
            style={{
                marginTop: '20px',
                padding: '15px',
                border: '1px solid #ccc',
                borderRadius: '8px',
            }}
        >
            <h3>Real-time Tunnel Chat</h3>
            <div
                className='messages'
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
                    type='text'
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder='Type a message...'
                    style={{ flex: 1, padding: '5px' }}
                />
                <button type='submit'>Send</button>
            </form>
        </div>
    );
};
