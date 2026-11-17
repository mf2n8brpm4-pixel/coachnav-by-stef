

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

// Paste your EXISTING HERE API key between these quotation marks.

const HERE_API_KEY = "Fav5zkRAQl0p63_T0GEfk79RfI5P9Wag6fmeI-fnHsE";

const $ = id => document.getElementById(id);

const map = L.map("map", {

  zoomControl: false

}).setView([51.5074, -0.1278], 6);

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

function toast(message) {

  const el = $("toast");

  if (!el) return;

  el.textContent = message;

  el.classList.add("show");

  setTimeout(() => {

    el.classList.remove("show");

  }, 3200);

}

function setProfile(name) {

  currentProfile = name;

  document.querySelectorAll(".vehicle-option").forEach(button => {

    button.classList.toggle(

      "selected",

      button.dataset.profile === name

    );

  });

  const profile = profiles[name];

  ["height", "length", "width", "weight"].forEach(key => {

    $(key).value = profile[key];

  });

}

document.querySelectorAll(".vehicle-option").forEach(button => {

  button.addEventListener("click", () => {

    setProfile(button.dataset.profile);

  });

});

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

  } catch (error) {}

  toast("Vehicle profile saved on this device.");

});

try {

  const saved = JSON.parse(

    localStorage.getItem("coachnav_profiles_v2") || "null"

  );

  if (saved) {

    Object.assign(profiles, saved);

  }

} catch (error) {}

setProfile("touring");

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

// Decode HERE Flexible Polyline geometry.

function decodeHerePolyline(encoded) {

  let index = 0;

  let lat = 0;

  let lon = 0;

  const points = [];

  function readValue() {

    let result = 0;

    let shift = 0;

    let value;

    do {

      value = encoded.charCodeAt(index++) - 63;

      result |= (value & 0x1f) << shift;

      shift += 5;

    } while (value >= 0x20);

    return (result & 1)

      ? ~(result >> 1)

      : (result >> 1);

  }

  const header = encoded.charCodeAt(index++) - 63;

  const precision = Math.pow(10, -(header & 15));

  const thirdDim = (header >> 4) & 7;

  if (thirdDim) {

    encoded.charCodeAt(index++) - 63;

  }

  while (index < encoded.length) {

    lat += readValue();

    lon += readValue();

    points.push([

      lat * precision,

      lon * precision

    ]);

    if (thirdDim) {

      readValue();

    }

  }

  return points;

}

$("previewRoute").addEventListener("click", async event => {

  event.preventDefault();

  const from = $("origin").value.trim();

  const to = $("destination").value.trim();

  if (!from || !to) {

    toast("Enter both a starting point and destination.");

    return;

  }

  if (

    !HERE_API_KEY ||

    HERE_API_KEY === "Fav5zkRAQl0p63_T0GEfk79RfI5P9Wag6fmeI-fnHsE"

  ) {

    toast("Add your existing HERE API key in app.js.");

    return;

  }

  const button = $("previewRoute");

  button.disabled = true;

  button.textContent = "Calculating route...";

  $("routeMessage").textContent = "Finding coach route...";

  try {

    const a = await geocode(from);

    const b = await geocode(to);

    const profile = profiles[currentProfile];

    const params = new URLSearchParams({

      transportMode: "truck",

      origin: `${a.lat},${a.lon}`,

      destination: `${b.lat},${b.lon}`,

      routingMode: "fast",

      return: "polyline,summary",

      "vehicle[height]": String(

        Math.round(Number(profile.height) * 100)

      ),

      "vehicle[length]": String(

        Math.round(Number(profile.length) * 100)

      ),

      "vehicle[width]": String(

        Math.round(Number(profile.width) * 100)

      ),

      "vehicle[grossWeight]": String(

        Math.round(Number(profile.weight) * 1000)

      ),

      apiKey: HERE_API_KEY

    });

    const response = await fetch(

      "https://router.hereapi.com/v8/routes?" + params

    );

    const data = await response.json();

    if (!response.ok) {

      throw new Error(

        data.cause ||

        data.title ||

        "HERE routing failed."

      );

    }

    if (!data.routes || !data.routes.length) {

      throw new Error("No route found for this vehicle.");

    }

    const sections = data.routes[0].sections;

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

    markers.forEach(marker => {

      map.removeLayer(marker);

    });

    markers = [];

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

        "HERE truck route calculated for your selected vehicle profile. Check all restrictions before travelling.";

    }

    setTimeout(() => map.invalidateSize(), 200);

  } catch (error) {

    $("routeMessage").textContent = error.message;

    toast(error.message);

  } finally {

    button.disabled = false;

    button.textContent = "Show route on map";

  }

});

$("locateMe").addEventListener("click", () => {

  if (!navigator.geolocation) {

    toast("Location is not supported by this browser.");

    return;

  }

  $("routeMessage").textContent =

    "Requesting your location…";

  navigator.geolocation.getCurrentPosition(

    position => {

      const location = [

        position.coords.latitude,

        position.coords.longitude

      ];

      map.setView(location, 14);

      L.marker(location)

        .addTo(map)

        .bindPopup("Your current location")

        .openPopup();

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

$("installHelp").addEventListener("click", () => {

  alert(

    "In Safari on your iPhone: tap the Share button, scroll down, choose Add to Home Screen, then tap Add."

  );

});

let deferredPrompt;

window.addEventListener("beforeinstallprompt", event => {

  event.preventDefault();

  deferredPrompt = event;

  $("installBtn").hidden = false;

});

$("installBtn").addEventListener("click", async () => {

  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  await deferredPrompt.userChoice;

  deferredPrompt = null;

  $("installBtn").hidden = true;

});

if (

  "serviceWorker" in navigator &&

  location.protocol.startsWith("http")

) {

  window.addEventListener("load", () => {

    navigator.serviceWorker

      .register("./sw.js")

      .catch(() => {});

  });
