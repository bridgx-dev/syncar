import { useState, useEffect, useCallback } from 'react';
import type { TunnelChannel } from '@tunnel/core';

type UseTunnelReturn<T = any> = {
    data: T | null;
    send: (data: T) => void;
};

const useTunnel = <T = any>(tunnel: TunnelChannel<T>): UseTunnelReturn<T> => {
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
        const unsubscribe = tunnel.receive((receivedData) => {
            setData(receivedData);
        });
        return () => unsubscribe();
    }, [tunnel]);

    const send = useCallback(
        (newData: T) => {
            tunnel.send(newData);
            setData(newData); // Optimistic local update
        },
        [tunnel],
    );

    return { data, send };
};

export { useTunnel };
