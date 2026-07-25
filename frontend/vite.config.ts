// frontend/vite.config.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo-192.png'],
      manifest: {
        name:             'Semence Epargne',
        short_name:       'SemenceEp',
        description:      'Plateforme de microfinance — Le Credit Panafricain',
        theme_color:      '#F65A04',
        background_color: '#0F2E52',
        display:          'standalone',
        start_url:        '/',
        icons: [
          { src:'/logo-192.png', sizes:'192x192', type:'image/png' },
          { src:'/logo.png',     sizes:'512x512', type:'image/png', purpose:'any maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: { '/api': { target:'http://localhost:4000', changeOrigin:true } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
