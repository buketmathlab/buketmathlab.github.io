import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fontlar ve tokenlar uygulamanın kendisiyle AYNI kaynaktan geliyor
// (`main.tsx` ile birebir aynı iki satır). Tanıtım sayfasına ayrı bir stil
// dosyası yazsaydım iki yer zamanla ayrışır ve sayfa ürüne benzemeyi
// bırakırdı.
import './styles/fontlar.css';
import './styles/index.css';

import { Tanitim } from './pages/Tanitim';
import { yayindakiSurum } from './hooks/useSurumDenetimi';
import { tazelemeAdresi } from './lib/tazele';

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

/**
 * SESSİZ TAZELEME — bayat önbelleğin karşılığı.
 *
 * ÖLÇÜLDÜ: GitHub Pages HTML'i `cache-control: max-age=600` ile
 * gönderiyor. Yeni sürüm yayınlandıktan sonra tarayıcı 10 dakika boyunca
 * eski HTML'i verebiliyor ve o HTML dosya adı hash'li ESKİ paketi
 * çağırıyor — sayfa yayında yenilenmiş olduğu hâlde kullanıcı eskisini
 * görüyor. Öğretmen tam olarak bunu yaşadı.
 *
 * Uygulamada bu iş `SurumSeridi` ile ÇÖZÜLMÜŞTÜ; tanıtım sayfası
 * uygulamadan hiçbir şey içe aktarmadığı için buraya hiç bağlanmamıştı.
 * Gerekçe (sayfa sunucuya istek atmasın) hâlâ geçerli ve bozulmuyor:
 * `surum.json` sayfanın KENDİ kaynağında, üçüncü tarafa da veritabanına
 * da tek bayt çıkmıyor.
 *
 * ÇİZİMDEN SONRA ÇAĞRILIYOR. Önce beklenip sonra çizseydik, güncel bir
 * ziyaretçi (ki çoğunluk odur) boş ekrana bakarak ağ isteğini beklerdi.
 * Sayfa hemen açılıyor; tazeleme gerekiyorsa zaten ilk saniyede oluyor.
 *
 * KARARIN KENDİSİ `lib/tazele.ts` içinde — sonsuz döngü kilidi dahil,
 * testleriyle birlikte.
 */
void (async () => {
  const adres = tazelemeAdresi(
    window.location.href,
    __SEKIZ_SURUM__,
    await yayindakiSurum(),
  );
  // `replace`: tazeleme tarayıcı geçmişine girmiyor, yoksa "geri"
  // tuşu ziyaretçiyi bayat sayfaya döndürürdü.
  if (adres) window.location.replace(adres);
})();
