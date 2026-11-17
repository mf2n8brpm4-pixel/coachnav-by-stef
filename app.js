

const profiles = {

  touring: {

    height: "3.90",

    length: "15.00",

    width: "2.55",

    weight: "26"

  },

  double: {

    height: "4.40",

    length: "15.00",

    width: "2.55",

    weight: "26"

  }

};

let currentProfile = "touring";

// Your HERE API key

const HERE_API_KEY = "Fav5zkRAQl0p63_T0GEfk79RfI5P9Wag6fmeI-fnHsE";

const $ = id => document.getElementById(id);

const map = L.map("map", {

  zoomControl: false

}).setView([50.7184, -3.5339], 9);

L.tileLayer(

  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

  {

    maxZoom: 19,

    attribution:

      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  }

).addTo(map);

L.control.zoom({

  position: "bottomright"

}).addTo(map);

let markers = [];

let currentLocation = null;

function toast(message) {

  const el = $("toast");

  if (!el) return;

  el.textContent = message;

  el.classList.add("show");

  setTimeout(() => {

    el.classList.remove("show");

  }, 3200);

}

function clearMapMarkers() {

  markers.forEach(marker => map.removeLayer(marker));

  markers = [];

}

function setProfile(name) {

  if (!profiles[name]) return;

  currentProfile = name;

  document.querySelectorAll(".vehicle-option").forEach(button => {

    button.classList.toggle(

      "selected",

      button.dataset.profile === name

    );

  });

  const profile = profiles[name];

  ["height", "length", "width", "weight"].forEach(key => {

    const field = $(key);

    if (field) field.value = profile[key];

  });

}

document.querySelectorAll(".vehicle-option").forEach(button => {

  button.addEventListener("click", () => {

    setProfile(button.dataset.profile);

  });

});

if ($("saveVehicle")) {

  $("saveVehicle").addEventListener("click", () => {

    const profile = {};

    let valid = true;

    ["height", "length", "width", "weight"].forEach(key => {

      profile[key] = $(key).value;

      if (!profile[key] || Number(profile[key]) <= 0) {

        valid = false;

      }

    });

    if (!valid) {

      toast("Please enter valid vehicle dimensions.");

      return;

    }

    profiles[currentProfile] = profile;

    try {

      localStorage.setItem(

        "coachnav_profiles_v2",

        JSON.stringify(profiles)

      );

    } catch (error) {

      console.warn("Could not save vehicle profile.", error);

    }

    toast("Vehicle profile saved on this device.");

  });

}

try {

  const saved = JSON.parse(

    localStorage.getItem("coachnav_profiles_v2") || "null"

  );

  if (saved) {

    Object.assign(profiles, saved);

  }

} catch (error) {

  console.warn("Could not load saved vehicle profiles.", error);

}

setProfile("touring");

// Find a location using OpenStreetMap Nominatim.

async function geocode(query) {

  const url =

    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +

    encodeURIComponent(query);

  const response = await fetch(url, {

    headers: {

      Accept: "application/json"

    }

  });

  if (!response.ok) {

    throw new Error("Location service unavailable.");

  }

  const data = await response.json();

  if (!data.length) {

    throw new Error("Could not find: " + query);

  }

  return {

    lat: Number(data[0].lat),

    lon: Number(data[0].lon),

    name: data[0].display_name

  };

}

// Decode HERE Flexible Polyline.

function decodeHerePolyline(encoded) {

  const alphabet =

    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  let index = 0;

  let lastLat = 0;

  let lastLon = 0;

  const points = [];

  function decodeUnsignedVarint() {

    let result = 0;

    let shift = 0;

    while (index < encoded.length) {

      const value = alphabet.indexOf(encoded[index++]);

      if (value < 0) {

        throw new Error("Invalid HERE route geometry.");

      }

      result |= (value & 0x1f) << shift;

      if ((value & 0x20) === 0) {

        return result;

      }

      shift += 5;

      if (shift > 30) {

        throw new Error("Invalid HERE route geometry.");

      }

    }

    throw new Error("Incomplete HERE route geometry.");

  }

  function decodeSignedVarint() {

    const value = decodeUnsignedVarint();

    return (value & 1)

      ? ~(value >> 1)

      : (value >> 1);

  }

  const version = decodeUnsignedVarint();

  if (version !== 1) {

    throw new Error("Unsupported HERE polyline version.");

  }

  const precision = decodeUnsignedVarint();

  const thirdDim = decodeUnsignedVarint();

  const thirdDimPrecision = decodeUnsignedVarint();

  const factor = Math.pow(10, precision);

  const thirdDimFactor = Math.pow(10, thirdDimPrecision);

  while (index < encoded.length) {

    lastLat += decodeSignedVarint();

    lastLon += decodeSignedVarint();

    points.push([

      lastLat / factor,

      lastLon / factor

    ]);

    if (thirdDim !== 0) {

      decodeSignedVarint();

    }

  }

  return points;

}

// Calculate and display a vehicle-aware route.

if ($("previewRoute")) {

  $("previewRoute").addEventListener("click", async event => {

    event.preventDefault();

    const from = $("origin").value.trim();

    const to = $("destination").value.trim();

    if (!from || !to) {

      toast("Enter both a starting point and destination.");

      return;

    }

    const button = $("previewRoute");

    button.disabled = true;

    button.textContent = "Calculating route...";

    $("routeMessage").textContent = "Finding your vehicle route...";

    try {

      const a =

        from === "My current location" && currentLocation

          ? currentLocation

          : await geocode(from);

      const b = await geocode(to);

      const profile = profiles[currentProfile];

      const params = new URLSearchParams();

      params.set("transportMode", "truck");

      params.set("origin", `${a.lat},${a.lon}`);

      params.set("destination", `${b.lat},${b.lon}`);

      params.set("routingMode", "fast");

      params.set("return", "polyline,summary");

      params.set("spans", "notices");

      params.set(

        "vehicle[height]",

        String(Math.round(Number(profile.height) * 100))

      );

      params.set(

        "vehicle[length]",

        String(Math.round(Number(profile.length) * 100))

      );

      params.set(

        "vehicle[width]",

        String(Math.round(Number(profile.width) * 100))

      );

      params.set(

        "vehicle[grossWeight]",

        String(Math.round(Number(profile.weight) * 1000))

      );

      params.set("apiKey", HERE_API_KEY);

      const response = await fetch(

        "https://router.hereapi.com/v8/routes?" + params.toString()

      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(

          data.cause ||

          data.title ||

          data.message ||

          "HERE routing failed. Check your API access."

        );

      }

      if (!data.routes || !data.routes.length) {

        throw new Error("No route found for this vehicle.");

      }

      const sections = data.routes[0].sections || [];

      const route = [];

      sections.forEach(section => {

        if (section.polyline) {

          route.push(

            ...decodeHerePolyline(section.polyline)

          );

        }

      });

      if (!route.length) {

        throw new Error("HERE returned no route line.");

      }

      clearMapMarkers();

      const roadLine = L.polyline(route, {

        color: "#1677ff",

        weight: 6,

        opacity: 0.9

      }).addTo(map);

      markers.push(roadLine);

      markers.push(

        L.marker([a.lat, a.lon])

          .addTo(map)

          .bindPopup("START: " + a.name)

      );

      markers.push(

        L.marker([b.lat, b.lon])

          .addTo(map)

          .bindPopup("DESTINATION: " + b.name)

      );

      map.fitBounds(roadLine.getBounds(), {

        padding: [35, 35]

      });

      const notices = sections.flatMap(section =>

        section.notices || []

      );

      const criticalNotices = notices.filter(notice =>

        notice.severity === "critical"

      );

      if (criticalNotices.length) {

        $("routeMessage").textContent =

          "Route calculated, but HERE reports a critical vehicle restriction. Do not rely on this route until checked.";

      } else {

        $("routeMessage").textContent =

          "Vehicle route calculated. Check road restrictions and signs before travelling.";

      }

      setTimeout(() => map.invalidateSize(), 200);

    } catch (error) {

      console.error(error);

      $("routeMessage").textContent = error.message;

      toast(error.message);

    } finally {

      button.disabled = false;

      button.textContent = "Show route on map";

    }

  });

}

// Find and display your current location.

if ($("locateMe")) {

  $("locateMe").addEventListener("click", () => {

    if (!navigator.geolocation) {

      toast("Location is not supported by this browser.");

      return;

    }

    $("routeMessage").textContent =

      "Requesting your location...";

    navigator.geolocation.getCurrentPosition(

      position => {

        currentLocation = {

          lat: position.coords.latitude,

          lon: position.coords.longitude,

          name: "Your current location"

        };

        const coordinates = [

          currentLocation.lat,

          currentLocation.lon

        ];

        map.setView(coordinates, 14);

        const marker = L.marker(coordinates)

          .addTo(map)

          .bindPopup("Your current location")

          .openPopup();

        markers.push(marker);

        $("origin").value = "My current location";

        $("routeMessage").textContent =

          "Your location is shown on the map.";

      },

      () => {

        toast(

          "Could not access location. Check iPhone location permissions."

        );

      },

      {

        enableHighAccuracy: true,

        timeout: 12000

      }

    );

  });

}

// Installation help.

if ($("installHelp")) {

  $("installHelp").addEventListener("click", () => {

    alert(

      "In Safari on your iPhone: tap the Share button, scroll down, choose Add to Home Screen, then tap Add."

    );

  });

}

// App installation.

let deferredPrompt;

window.addEventListener("beforeinstallprompt", event => {

  event.preventDefault();

  deferredPrompt = event;

  if ($("installBtn")) {

    $("installBtn").hidden = false;

  }

});

if ($("installBtn")) {

  $("installBtn").addEventListener("click", async () => {

    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;

    $("installBtn").hidden = true;

  });

}

// Register service worker.

if (

  "serviceWorker" in navigator &&

  location.protocol.startsWith("http")

) {

  window.addEventListener("load", () => {

    navigator.serviceWorker

      .register("./sw.js")

      .catch(error => {

        console.warn("Service worker registration failed.", error);

      });

  });

}
