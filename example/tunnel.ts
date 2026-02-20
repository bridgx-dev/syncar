import { Channel } from '@tunnel/core';

export type ChatMessage = {
    user: string;
    text: string;
    timestamp: number;
};

export const chat = new Channel<ChatMessage[]>({ name: 'chat' });
export const counter = new Channel<number>({ name: 'counter' });
