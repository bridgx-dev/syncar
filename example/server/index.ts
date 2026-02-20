import express from 'express';
import { tunnel, chat, counter, type ChatMessage } from '../tunnel';

const app = express();
app.use(express.json());

// Pass the app to the tunnel if it was already created
// Or just let it run on port 3000 if that's what we want.
// In the shared tunnel.ts, it creates its own server by default.

app.get('/', (req, res) => {
    res.json({ message: 'Hello World!' });
});

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

// Attach the tunnel to the shared server to use the same port
tunnel.attachToServer(server);
