import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/fontlar.css';
import './styles/index.css';

import { Aydinlatma } from './pages/Aydinlatma';

/**
 * Aydınlatma metninin giriş noktası — uygulamadan AYRI (tanıtım sayfasıyla
 * aynı gerekçe): adres `/yeni/aydinlatma/`, oturum gerekmiyor ve sayfa
 * sunucuya HİÇ istek atmıyor. Veli onam vermeden önce de, giriş yapmadan
 * da okuyabilmeli.
 */
const kok = document.getElementById('root');
if (!kok) throw new Error('#root bulunamadı');

createRoot(kok).render(
  <StrictMode>
    <Aydinlatma />
  </StrictMode>,
);
