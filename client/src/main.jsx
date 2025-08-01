import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import socketService from './services/socketService'

// Handle app-level socket cleanup
window.addEventListener('beforeunload', () => {
  socketService.disconnect();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)