// Fresh when the signal is good, the saved copy when it's slow or gone.
// Waits at most 3 seconds for the network before showing the saved copy,
// and still updates the saved copy in the background when the network answers.
const C = "japan-2026";
const WAIT = 3000;

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(C).then(function (c) {
      return c.addAll(["./", "./index.html", "./manifest.json"]);
    }).catch(function () {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim());
});

function saved(req) {
  return caches.match(req).then(function (r) {
    if (r || req.mode !== "navigate") return r;
    return caches.match("./index.html").then(function (x) { return x || caches.match("./"); });
  });
}

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return; // never touch Maps or booking links

  e.respondWith(new Promise(function (resolve) {
    let done = false;
    function finish(r) { if (!done && r) { done = true; resolve(r); } }

    const net = fetch(e.request).then(function (r) {
      if (r && r.ok) {
        const copy = r.clone();
        caches.open(C).then(function (c) { c.put(e.request, copy); });
      }
      return r;
    });

    net.then(finish, function () {
      saved(e.request).then(function (r) {
        if (r) finish(r);
        else if (!done) { done = true; resolve(Response.error()); }
      });
    });

    setTimeout(function () { saved(e.request).then(finish); }, WAIT);
  }));
});
