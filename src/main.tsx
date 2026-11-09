import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import './theme-soft.css'
import './theme-meadow.css'
import './lib/scene'
import App from './App.tsx'
import { SceneSync } from './components/theme-picker'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SceneSync />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
