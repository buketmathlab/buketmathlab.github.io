import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fontlar ve tokenlar uygulamanın kendisiyle AYNI kaynaktan geliyor
// (`main.tsx` ile birebir aynı iki satır). Tanıtım sayfasına ayrı bir stil
// dosyası yazsaydım iki yer zamanla ayrışır ve sayfa ürüne benzemeyi
// bırakırdı.
import './styles/fontlar.css';
import './styles/index.css';

import { Tanitim } from './pages/Tanitim';

/**
 * Tanıtım sayfasının giriş noktası — uygulamadan AYRI.
 *
 * NEDEN İKİNCİ BİR GİRİŞ NOKTASI: adres `/yeni/tanitim/` olsun diye
 * (öğretmenin kararı). Uygulamanın içinde bir rota olsaydı adres
 * `/yeni/#/tanitim` olurdu ve bazı uygulamalar bağlantıyı `#`ten böler.
 *
 * Yan fayda ölçülebilir: burada ne HashRouter var, ne oturum sağlayıcı, ne
 * Supabase istemcisi. Tanıtım sayfası SUNUCUYA HİÇ İSTEK ATMIYOR — yani
 * sayfayı açan bir müdürün ya da velinin tarayıcısından veritabanına tek
 * bir çağrı gitmiyor. Aynı sebeple bu sayfanın kodu öğrencinin her gün
 * indirdiği pakete de girmiyor.
 */
const kok = document.getElementById('root');
if (!kok) throw new Error('#root bulunamadı');

createRoot(kok).render(
  <StrictMode>
    <Tanitim />
  </StrictMode>,
);
