import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/ana.css'

const kok = document.getElementById('kok')
if (!kok) throw new Error('Kök öğe bulunamadı: #kok')

createRoot(kok).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
