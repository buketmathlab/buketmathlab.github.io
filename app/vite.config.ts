import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Sürüm damgası — `?y=22` zahmetinin sonu.
 *
 * SORUN ÖLÇÜLDÜ: GitHub Pages HTML'i `cache-control: max-age=600` ile
 * gönderiyor. Yeni sürüm yayınlandıktan sonra 10 dakika boyunca tarayıcı
 * eskisini gösterebiliyor ve öğretmen bunu adres çubuğuna elle `?y=N`
 * yazarak aşıyordu.
 *
 * ÇÖZÜM: her yapı bir kimlik alır. Kimlik hem pakete gömülür hem de ayrı
 * bir `surum.json` dosyasına yazılır. Çalışan uygulama o dosyayı
 * `cache: 'no-store'` ile okur — bu istek tarayıcı önbelleğini ATLAR,
 * dolayısıyla HTML eski olsa bile yeni sürüm saniyeler içinde görülür.
 *
 * Kimlik zamandan üretiliyor; içerik hash'i değil. Gerekçe: aynı içeriğin
 * yeniden yayınlanması da (örneğin bir geri alma) kullanıcıya bildirilmeli.
 */
function surumDamgasi(): Plugin {
  const surum = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return {
    name: 'sekiz-surum-damgasi',
    config: () => ({ define: { __SEKIZ_SURUM__: JSON.stringify(surum) } }),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'surum.json',
        source: JSON.stringify({ surum }) + '\n',
      });
    },
  };
}

// SEKİZ, mevcut uygulamayı bozmadan /yeni/ alt adresinde yayınlanır.
// Kök dizindeki index.html (eski uygulama) build tarafından ASLA değiştirilmez.
export default defineConfig({
  base: '/yeni/',
  plugins: [react(), tailwindcss(), surumDamgasi()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../yeni',
    emptyOutDir: true,
    rollupOptions: {
      /**
       * İKİ GİRİŞ NOKTASI (Faz 9).
       *
       *   index.html          → /yeni/            uygulama
       *   tanitim/index.html  → /yeni/tanitim/    herkese açık tanıtım
       *
       * Çıktı yolları kaynaktaki klasör yapısını birebir izliyor; adresin
       * `#` içermemesinin tek sebebi bu. Öğretmenin dışarıya vereceği
       * bağlantı `buketmathlab.github.io/yeni/tanitim/` oluyor.
       *
       * KÖK `index.html` BUNDAN ETKİLENMİYOR: burada adı geçen iki dosya da
       * `app/` altında; depo kökündeki eski uygulamaya yapı hattı hiçbir
       * koşulda dokunmuyor (`outDir` yalnız `../yeni`).
       */
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        tanitim: fileURLToPath(new URL('./tanitim/index.html', import.meta.url)),
      },
    },
    // Faz 0'da paket boyutunu görünür tutuyoruz; büyüdükçe uyarı alalım.
    chunkSizeWarningLimit: 300,
    // Vite'ın varsayılan hedefi safari14; oysa ürün ZATEN daha yenisini
    // gerektiriyor — Tailwind 4 Safari 16.4+ istiyor. Varsayılanı bırakmak
    // gerçekte desteklemediğimiz tarayıcıları destekliyormuş gibi
    // görünmekti.
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
