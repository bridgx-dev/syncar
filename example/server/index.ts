import express from 'express';
import { Tunnel } from '@tunnel/core';
import { chat, counter, type ChatMessage } from '../tunnel';

const app = express();
app.use(express.json());

// Create the backend Tunnel instance
const tunnel = new Tunnel();

app.get('/', (req, res) => {
    res.json({ message: 'Hello Synnel!' });
});

// Bind shared channels to this tunnel
chat.bind(tunnel);
counter.bind(tunnel);

let serverMessages: ChatMessage[] = [];
chat.receive((data) => {
    console.log('Server received chat history sync:', data);
    serverMessages = data;
});

app.post('/send', (req, res) => {
    const { message } = req.body;
    const newMessage: ChatMessage = {
        user: 'Server',
        text: message,
        timestamp: Date.now(),
    };
    serverMessages = [...serverMessages, newMessage];
    chat.send(serverMessages);
    res.json({ status: 'Message sent' });
});

let serverCount = 0;
counter.receive((data) => {
    console.log('Server received counter update:', data);
    serverCount = data;
});

const server = app.listen(3000, () => {
    console.log('Server is running on port 3000 (Combined Express + WebSocket)');
});

// Attach the tunnel to the express server
tunnel.attachToServer(server);
