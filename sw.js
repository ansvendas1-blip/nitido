// Nítido — Service Worker
// Estratégia network-first: com internet, sempre a versão mais nova
// (o app se atualiza sozinho); sem internet, serve a última em cache.
//
// ATENÇÃO — armadilha já paga uma vez (15/07/2026):
// `fetch(req)` sozinho NÃO garante versão nova. Ele passa pelo cache HTTP do
// navegador, e o GitHub Pages manda o HTML com Cache-Control de ~10 min.
// Resultado: "network-first" buscava na rede e a rede devolvia a cópia velha.
// O app parecia não atualizar mesmo com o deploy feito.
// Por isso o HTML é buscado com {cache:'no-store'}: pula o cache HTTP e vai
// direto ao servidor. É o que faz valer a promessa de "atualiza sozinho".
const CACHE = 'nitido-v4';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// documento (navegação) ou o próprio index.html → sempre no-store
function ehDocumento(req) {
  return req.mode === 'navigate' ||
         req.destination === 'document' ||
         /\/(index\.html)?(\?.*)?$/.test(new URL(req.url).pathname + new URL(req.url).search);
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // Supabase e CDN passam direto

  const opts = ehDocumento(e.request) ? { cache: 'no-store' } : undefined;

  e.respondWith(
    fetch(e.request, opts)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
