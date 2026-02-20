import { useState, useEffect } from 'react';
import { tunnel } from '../tunnel';

export const ConnectionStatus = () => {
    const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>(tunnel.status);

    useEffect(() => {
        // tunnel.onStatusChange was added to the core in the previous step
        const unsubscribe = tunnel.onStatusChange((newStatus) => {
            setStatus(newStatus);
        });
        return () => unsubscribe();
    }, []);

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
