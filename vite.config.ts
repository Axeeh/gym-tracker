import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'

// Genera dist/sw.js con l'elenco di tutti i file della build, cosi' l'app
// funziona anche senza campo in palestra. La versione della cache cambia a
// ogni build diversa, e il service worker vecchio viene sostituito.
function serviceWorker(): Plugin {
  return {
    name: 'scheda-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync(new URL('./public', import.meta.url)).filter(
        (f) => !f.startsWith('.'),
      )
      const files = ['./', ...Object.keys(bundle), ...publicFiles].map((f) =>
        f === './' ? f : `./${f}`,
      )
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: swSource(version, files),
      })
    },
  }
}

function swSource(version: string, files: string[]) {
  return `// Generato dalla build: non modificare a mano.
const CACHE = 'scheda-${version}'
const FILES = ${JSON.stringify(files)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./', { cacheName: CACHE }).then((hit) => hit || fetch(req)))
    return
  }
  event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit || fetch(req)))
})
`
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  // node_modules e' un symlink verso node_modules.nosync (fuori da iCloud):
  // senza questa opzione Vite non riconosce le dipendenze in sviluppo
  resolve: { preserveSymlinks: true },
  server: { port: 5180 },
  preview: { port: 5181 },
})
