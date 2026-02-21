import { createRoot } from 'react-dom/client'
import { SynnelProvider } from '@synnel/react'

import './index.css'
import App from './App.tsx'
import { StrictMode } from 'react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SynnelProvider options={{ url: 'ws://localhost:3000/ws' }}>
      <App />
    </SynnelProvider>
  </StrictMode>,
)
