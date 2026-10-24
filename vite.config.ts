import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'

// Genera dist/sw.js con l'elenco di tutti i file della build, cosi' l'app
// funziona anche senza campo in palestra. La versione della cache cambia a
// ogni build diversa, e il service worker vecchio viene sostituito.
// La pagina si chiede prima alla rete (Netlify ci aggiunge cose dopo la build),
// la copia salvata serve solo offline o con poco campo.
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
      // Anche il contenuto dei file di public/: un'icona rifatta con lo stesso nome cambia versione
      const hash = createHash('sha256').update(files.join('|'))
      for (const f of publicFiles) hash.update(readFileSync(new URL(`./public/${f}`, import.meta.url)))
      const version = hash.digest('hex').slice(0, 10)
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

// ignoreVary: un'intestazione Vary (es. Origin) non deve impedire di trovare i file offline
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // Rete prima, con 3 secondi di pazienza: poi la copia salvata, che si aggiorna a ogni apertura
    const fresh = fetch('./', { cache: 'no-cache' }).then((res) => {
      // La copia va fatta subito: la risposta originale la legge la pagina
      if (res.ok) {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('./', copy))
      }
      return res
    })
    const slow = new Promise((resolve) => setTimeout(resolve, 3000))
      .then(() => caches.match('./', { cacheName: CACHE, ignoreVary: true }))
    event.respondWith(
      Promise.race([
        // Offline: la copia salvata subito, senza aspettare i 3 secondi
        fresh.catch(() => caches.match('./', { cacheName: CACHE, ignoreVary: true })),
        slow.then((hit) => hit || fresh),
      ])
        .then((res) => res || caches.match('./', { cacheName: CACHE, ignoreVary: true })),
    )
    return
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)))
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
