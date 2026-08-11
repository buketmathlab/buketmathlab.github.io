import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// SEKİZ, mevcut uygulamayı bozmadan /yeni/ alt adresinde yayınlanır.
// Kök dizindeki index.html (eski uygulama) build tarafından ASLA değiştirilmez.
export default defineConfig({
  base: '/yeni/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../yeni',
    emptyOutDir: true,
    // Faz 0'da paket boyutunu görünür tutuyoruz; büyüdükçe uyarı alalım.
    chunkSizeWarningLimit: 300,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
