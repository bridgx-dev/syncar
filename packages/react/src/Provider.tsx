import React, { createContext, useContext, useEffect, useState } from 'react';
import { TunnelClient, type TunnelOptions } from '@tunnel/core';

export type TunnelProviderProps = {
    children: React.ReactNode;
    options?: TunnelOptions;
    discoveryUrl?: string;
};

const TunnelContext = createContext<TunnelClient | null>(null);

export const TunnelProvider = ({ children, options, discoveryUrl }: TunnelProviderProps) => {
    const [tunnel, setTunnel] = useState<TunnelClient | null>(null);

    useEffect(() => {
        let active = true;
        let client: TunnelClient | null = null;

        const init = async () => {
            let finalOptions = options || {};

            if (discoveryUrl) {
                try {
                    const res = await fetch(discoveryUrl);
                    const config = await res.json();
                    finalOptions = { ...finalOptions, ...config };
                } catch (e) {
                    console.error('Tunnel: Failed to discover config from', discoveryUrl, e);
                }
            }

            if (active) {
                client = new TunnelClient(finalOptions);
                setTunnel(client);
            }
        };

        init();

        return () => {
            active = false;
            if (client) client.disconnect();
        };
    }, [discoveryUrl, JSON.stringify(options)]);

    return <TunnelContext.Provider value={tunnel}>{children}</TunnelContext.Provider>;
};

export const useTunnelContext = () => {
    const context = useContext(TunnelContext);
    // Note: context can be null during initialization or if discovery fails
    return context;
};
