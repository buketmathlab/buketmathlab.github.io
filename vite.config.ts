import { fileURLToPath, URL } from 'node:url'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages tek sayfalık uygulamalarda /ogretmen gibi doğrudan adreslerde
 * 404 döner. Çözüm: derleme sonunda index.html'in bir kopyası 404.html olarak
 * yazılır; Pages bilinmeyen yolda bu dosyayı sunar, uygulama açılır ve yönlendirme
 * istemcide çözülür.
 */
function dortYuzDortYedegi(): Plugin {
  return {
    name: 'sekiz-404-yedegi',
    apply: 'build',
    closeBundle() {
      const cikti = resolve(import.meta.dirname, 'dist')
      copyFileSync(resolve(cikti, 'index.html'), resolve(cikti, '404.html'))
    },
  }
}

export default defineConfig({
  // buketmathlab.github.io bir "kullanıcı sitesi" olduğu için kök dizinde yayınlanır.
  base: '/',
  plugins: [react(), tailwindcss(), dortYuzDortYedegi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // Performans bütçesi: ana paket 200 KB (gzip) altında kalmalı.
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 2048,
  },
})
