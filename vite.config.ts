import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    allowedHosts: true,
  },
  plugins: [
    tailwindcss(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'BiblioLog',
        short_name: 'BiblioLog',
        description: 'Suivi perso de romans, BD et mangas lus',
        theme_color: '#14231c',
        background_color: '#14231c',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // html5-qrcode pèse ~370 Ko et n'est chargé qu'à l'ouverture du scanner (import
        // dynamique dans AddBook). Le précacher ferait télécharger plus de la moitié du
        // payload d'installation pour une fonction que la plupart des sessions n'ouvrent pas.
        globIgnores: ['**/esm-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/esm-.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'scanner' },
          },
        ],
      },
    }),
  ],
})
