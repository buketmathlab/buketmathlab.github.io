import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fontlar self-host edilir — Google Fonts CDN kullanılmaz.
// Gerekçe ikili: üçüncü taraf bağlantısı olmadığı için daha hızlı, ve
// ziyaretçi IP'si üçüncü tarafa gitmediği için KVKK açısından daha temiz.
// Alt küme seçimi ve gerekçesi: styles/fontlar.css
import './styles/fontlar.css';
import './styles/index.css';

import { App } from './App';

const kok = document.getElementById('root');
if (!kok) throw new Error('#root bulunamadı');

createRoot(kok).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
