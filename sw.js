

const CACHE = "coachnav-shell-v3";

const CORE = [

  "./",

  "./index.html",

  "./styles.css",

  "./app.js",

  "./manifest.webmanifest",

  "./icon.svg"

];

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE)

      .then(cache => cache.addAll(CORE))

      .then(() => self.skipWaiting())

  );

});

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()

      .then(names =>

        Promise.all(

          names

            .filter(name => name.startsWith("coachnav-shell-") && name !== CACHE)

            .map(name => caches.delete(name))

        )

      )

      .then(() => self.clients.claim())

  );

});

self.addEventListener("fetch", event => {

  const request = event.request;

  const url = new URL(request.url);

  if (

    request.method !== "GET" ||

    url.origin !== self.location.origin

  ) return;

  const isAppFile =

    url.pathname.endsWith("/app.js") ||

    url.pathname.endsWith("/index.html") ||

    request.mode === "navigate";

  if (isAppFile) {

    event.respondWith(

      fetch(request)

        .then(response => {

          if (response.ok) {

            const copy = response.clone();

            caches.open(CACHE).then(cache => cache.put(request, copy));

          }

          return response;

        })

        .catch(() =>

          caches.match(request).then(cached =>

            cached || caches.match("./index.html")

          )

        )

    );

    return;

  }

  event.respondWith(

    caches.match(request).then(cached =>

      cached || fetch(request).then(response => {

        if (response.ok) {

          const copy = response.clone();

          caches.open(CACHE).then(cache => cache.put(request, copy));

        }

        return response;

      })

    )

  );

});
