import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

import { counter } from '../tunnel';
import { useTunnel } from '@tunnel/react';
import { Chat } from './Chat';
import { ConnectionStatus } from './ConnectionStatus';

function App() {
    const { data: syncCount, send: updateRemote } = useTunnel(counter);

    const increment = () => {
        const next = (syncCount ?? 0) + 1;
        updateRemote(next);
    };

    return (
        <>
            <ConnectionStatus />
            <div>
                <a href='https://vite.dev' target='_blank'>
                    <img src={viteLogo} className='logo' alt='Vite logo' />
                </a>
                <a href='https://react.dev' target='_blank'>
                    <img src={reactLogo} className='logo react' alt='React logo' />
                </a>
            </div>
            <h1>Vite + Tunnel Sync</h1>
            <div className='card'>
                <button onClick={increment}>Synced count is {syncCount ?? 0}</button>
                <p>Open this in multiple tabs to see real-time sync!</p>

                <Chat />

                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className='read-the-docs'>Click on the Vite and React logos to learn more</p>
        </>
    );
}

export default App;
