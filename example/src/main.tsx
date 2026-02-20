import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { TunnelProvider } from '@tunnel/react';
import { tunnel } from '../tunnel';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TunnelProvider tunnel={tunnel}>
            <App />
        </TunnelProvider>
    </StrictMode>,
);
