const CACHE='tbs-studio-v1';
const ASSETS=['/','/index.html','/styles.css','/fonts.css','/app.js','/content.json','/manifest.webmanifest','/assets/emblem.svg','/assets/icon-192.png','/assets/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tbs-studio-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Customer submissions and the authenticated inbox must never enter the offline cache.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)));}return response;
  }).catch(async()=>{const cached=await caches.match(url.pathname);return cached||new Response('Offline. Reconnect and try again.',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
