import React, { createContext, useContext, useEffect, useState } from 'react';
import { Client, type ClientOptions } from '@tunnel/core';

export type TunnelProviderProps = {
    children: React.ReactNode;
    options?: ClientOptions;
    discoveryUrl?: string;
};

const TunnelContext = createContext<Client | null>(null);

export const TunnelProvider = ({ children, options, discoveryUrl }: TunnelProviderProps) => {
    const [tunnel, setTunnel] = useState<Client | null>(null);

    useEffect(() => {
        let active = true;
        let client: Client | null = null;

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
                client = new Client(finalOptions);
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
