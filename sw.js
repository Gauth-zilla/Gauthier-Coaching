/* Gauthier’s coaching : ouverture de l’appli sans réseau.
   - Avec du réseau, la page vient toujours de GitHub (dernière version) ; la copie gardée sur le téléphone est mise à jour au passage.
   - Sans réseau (ou réseau trop lent, plus de 4 s), la dernière copie gardée est utilisée.
   - Les fichiers Firebase (version 13.3.0, qui ne change jamais) sont gardés une fois pour toutes.
   - Les données (Firestore) et la connexion ne passent jamais par ce fichier : Firebase les garde déjà sur le téléphone.
   Interrupteur de secours : mettre ARRET à true puis mettre ce fichier en ligne. Au prochain lancement, chaque téléphone
   efface la copie gardée et revient au fonctionnement sans ce fichier. */
const ARRET=false;
const VERSION="gc-v1";
const FB=/^https:\/\/www\.gstatic\.com\/firebasejs\/13\.3\.0\//;
const PAGES=["./","./index.html","./beta.html","./manifest.webmanifest","./manifest-beta.webmanifest","./icon-192.png","./icon-512.png","./apple-touch-icon.png"];
const SDK=["firebase-app.js","firebase-auth.js","firebase-firestore.js"].map(f=>"https://www.gstatic.com/firebasejs/13.3.0/"+f);

self.addEventListener("install",e=>{self.skipWaiting();if(ARRET)return;
  e.waitUntil(caches.open(VERSION).then(c=>Promise.all(PAGES.concat(SDK).map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{})))))});

self.addEventListener("activate",e=>{e.waitUntil((async()=>{
  const ks=await caches.keys();await Promise.all(ks.filter(k=>ARRET||k!==VERSION).map(k=>caches.delete(k)));
  if(ARRET){await self.registration.unregister();const cs=await self.clients.matchAll({type:"window"});cs.forEach(c=>{try{c.navigate(c.url)}catch(x){}});return}
  await self.clients.claim()})())});

/* La page : d’abord le réseau (4 s au plus), sinon la copie gardée */
async function page(req){const c=await caches.open(VERSION),u=new URL(req.url),key=u.origin+u.pathname;
  const net=fetch(req).then(r=>{if(r&&r.ok&&r.type==="basic")c.put(key,r.clone());return r});
  net.catch(()=>{});const slow=new Promise(res=>setTimeout(res,4000,null));
  try{const r=await Promise.race([net,slow]);if(r)return r}catch(x){}
  const old=await c.match(key)||await c.match(/beta\.html$/.test(u.pathname)?"./beta.html":/coach/.test(u.pathname)?key:"./index.html")||await c.match("./");
  if(old)return old;return net}

/* Fichiers Firebase : la copie gardée, sinon le réseau */
async function sdk(req){const c=await caches.open(VERSION),old=await c.match(req.url);if(old)return old;
  const r=await fetch(req);if(r&&r.ok)c.put(req.url,r.clone());return r}

/* Icônes et manifeste : la copie gardée tout de suite, mise à jour en arrière-plan */
async function asset(req){const c=await caches.open(VERSION),old=await c.match(req.url);
  const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req.url,r.clone());return r}).catch(()=>null);
  return old||await net||fetch(req)}

self.addEventListener("fetch",e=>{if(ARRET)return;const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);
  if(r.mode==="navigate"&&u.origin===location.origin)return e.respondWith(page(r));
  if(FB.test(r.url))return e.respondWith(sdk(r));
  if(u.origin===location.origin&&/\.(png|webmanifest)$/.test(u.pathname))return e.respondWith(asset(r))});
