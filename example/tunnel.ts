import { Tunnel, TunnelChannel } from '@tunnel/core';

export const tunnel = new Tunnel();

export type ChatMessage = {
    user: string;
    text: string;
    timestamp: number;
};

export const chat = new TunnelChannel<ChatMessage[]>({
    tunnel,
    name: 'chat',
});

export const counter = new TunnelChannel<number>({
    tunnel,
    name: 'counter',
});
