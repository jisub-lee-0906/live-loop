import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// React StrictMode intentionally mounts, unmounts, then remounts components in dev.
// That is unsafe for this app because the Tone/Web Audio graph is created as a
// long-lived instrument and App cleanup disposes synth/player nodes on unmount.
// In Vite dev, StrictMode can therefore leave the visible app holding disposed
// audio nodes: UI clicks still work, but SOUND CHECK is silent.
createRoot(document.getElementById('root')!).render(<App />)
