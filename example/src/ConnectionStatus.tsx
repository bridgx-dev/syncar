import { useState, useEffect } from 'react';
import { useTunnelContext } from '@tunnel/react';

export const ConnectionStatus = () => {
    const tunnel = useTunnelContext();
    const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');

    useEffect(() => {
        if (!tunnel) {
            setStatus('connecting');
            return;
        }

        setStatus(tunnel.status);
        const unsubscribe = tunnel.onStatusChange((newStatus) => {
            setStatus(newStatus);
        });
        return () => unsubscribe();
    }, [tunnel]);

    const statusColors = {
        connecting: '#ffa500',
        open: '#4caf50',
        closed: '#f44336',
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: '10px',
                right: '10px',
                padding: '5px 10px',
                borderRadius: '15px',
                backgroundColor: statusColors[status],
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
            }}
        >
            <div
                style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                }}
            />
            Tunnel: {status.toUpperCase()}
        </div>
    );
};
