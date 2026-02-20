import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { TunnelProvider } from '@tunnel/react';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TunnelProvider options={{ port: 3000 }}>
            <App />
        </TunnelProvider>
    </StrictMode>,
);
