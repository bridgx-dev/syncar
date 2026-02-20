import React, { createContext, useContext } from 'react';
import type { Tunnel } from '@tunnel/core';

const TunnelContext = createContext<Tunnel | null>(null);

export const TunnelProvider = ({
    tunnel,
    children,
}: {
    tunnel: Tunnel;
    children: React.ReactNode;
}) => {
    return <TunnelContext.Provider value={tunnel}>{children}</TunnelContext.Provider>;
};

export const useTunnelContext = () => {
    const context = useContext(TunnelContext);
    if (!context) {
        throw new Error('useTunnelContext must be used within a TunnelProvider');
    }
    return context;
};
