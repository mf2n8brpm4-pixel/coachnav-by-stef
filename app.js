
// ==========================================
// COACHNAV BY STEF
// COMPLETE APPLICATION SCRIPT
// ==========================================

// HERE API KEY
const HERE_API_KEY = "Fav5zkRAQl0p63_T0GEfk79RfI5P9Wag6fmeI-fnHsE";

// ==========================================
// VEHICLE PROFILES
// ==========================================

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
let currentLocation = null;
let markers = [];

const $ = id => document.getElementById(id);

// ==========================================
// MAP SETUP
// ==========================================

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

// ==========================================
// NOTIFICATIONS
// ==========================================

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

// ==========================================
// MAP MARKERS AND ROUTE
// ==========================================

function clearMapMarkers() {
  markers.forEach(marker => {
    map.removeLayer(marker);
  });

  markers = [];
}

// ==========================================
// VEHICLE PROFILE SELECTION
// ==========================================

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

    if (field) {
      field.value = profile[key];
    }
  });
}

document.querySelectorAll(".vehicle-option").forEach(button => {
  button.addEventListener("click", () => {
    setProfile(button.dataset.profile);
  });
});

// ==========================================
// SAVE VEHICLE PROFILE
// ==========================================

if ($("saveVehicle")) {
  $("saveVehicle").addEventListener("click", () => {
    const profile = {};
    let valid = true;

    ["height", "length", "width", "weight"].forEach(key => {
      const field = $(key);

      profile[key] = field ? field.value : "";

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

// ==========================================
// LOAD SAVED VEHICLE PROFILES
// ==========================================

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

// ==========================================
// LOCATION SEARCH
// ==========================================

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

// ==========================================
// HERE FLEXIBLE POLYLINE DECODER
// CORRECTED VERSION
// ==========================================

function decodeHerePolyline(encoded) {

  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  let index = 0;

  function decodeUnsignedVarint() {

    let result = 0;
    let shift = 0;

    while (index < encoded.length) {

      const value = alphabet.indexOf(encoded[index++]);

      if (value < 0) {
        throw new Error("Invalid HERE polyline character.");
      }

      result += (value % 32) * Math.pow(2, shift);

      if (value < 32) {
        return result;
      }

      shift += 5;

      if (shift > 50) {
        throw new Error("HERE polyline value is too large.");
      }
    }

    throw new Error("Incomplete HERE route geometry.");
  }

  function decodeSignedVarint() {

    const value = decodeUnsignedVarint();
    const magnitude = Math.floor(value / 2);

    return value % 2 === 1
      ? -magnitude - 1
      : magnitude;
  }

  // Read version

  const version = decodeUnsignedVarint();

  if (version !== 1) {
    throw new Error("Unsupported HERE polyline version.");
  }

  // IMPORTANT:
  // HERE packs the precision and third dimension
  // into ONE header value.

  const header = decodeUnsignedVarint();

  const precision = header % 16;
  const thirdDim = Math.floor(header / 16) % 8;

  const factor = Math.pow(10, precision);

  let lastLat = 0;
  let lastLon = 0;

  const points = [];

  while (index < encoded.length) {

    lastLat += decodeSignedVarint();
    lastLon += decodeSignedVarint();

    // Consume optional altitude or third dimension.

    if (thirdDim !== 0) {
      decodeSignedVarint();
    }

    points.push([
      lastLat / factor,
      lastLon / factor
    ]);
  }

  if (points.length < 2) {
    throw new Error("HERE returned too few route points.");
  }

  return points;
}

// ==========================================
// CALCULATE COACH ROUTE USING HERE
// ==========================================

if ($("previewRoute")) {

  $("previewRoute").addEventListener("click", async event => {

    event.preventDefault();

    const from = $("origin").value.trim();
    const to = $("destination").value.trim();

    if (!from || !to) {
      toast("Enter both a starting point and destination.");
      return;
    }

    if (!HERE_API_KEY) {
      toast("Add your HERE API key in app.js first.");
      return;
    }

    const button = $("previewRoute");

    button.disabled = true;
    button.textContent = "Calculating route...";

    if ($("routeMessage")) {
      $("routeMessage").textContent =
        "Finding your coach vehicle route...";
    }

    try {

      // FIND STARTING POINT

      const a =
        from === "My current location" && currentLocation
          ? currentLocation
          : await geocode(from);

      // FIND DESTINATION

      const b = await geocode(to);

      const profile = profiles[currentProfile];

      // BUILD HERE ROUTING REQUEST

      const params = new URLSearchParams();

      params.set("transportMode", "truck");

      params.set("origin", `${a.lat},${a.lon}`);

      params.set("destination", `${b.lat},${b.lon}`);

      params.set("routingMode", "fast");

      params.set("return", "polyline,summary");

      params.set("spans", "notices");

      // VEHICLE DIMENSIONS
      // HERE HEIGHT, LENGTH AND WIDTH IN CM

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

      // GROSS WEIGHT IN KG

      params.set(
        "vehicle[grossWeight]",
        String(Math.round(Number(profile.weight) * 1000))
      );

      params.set("apiKey", HERE_API_KEY);

      // SEND REQUEST TO HERE

      const response = await fetch(
        "https://router.hereapi.com/v8/routes?" +
        params.toString()
      );

      let data;

      try {
        data = await response.json();
      } catch (error) {
        throw new Error("HERE returned an unreadable response.");
      }

      // CHECK API RESPONSE

      if (!response.ok) {

        const reason =
          data.cause ||
          data.title ||
          data.message ||
          data.status ||
          data.error ||
          "HERE routing request failed.";

        throw new Error(String(reason));
      }

      if (!data.routes || !data.routes.length) {
        throw new Error("HERE could not find a route.");
      }

      // EXTRACT ROUTE SECTIONS

      const sections = data.routes[0].sections || [];

      const route = [];

      sections.forEach(section => {

        if (section.polyline) {

          const decoded =
            decodeHerePolyline(section.polyline);

          route.push(...decoded);

        }

      });

      if (route.length < 2) {
        throw new Error("HERE returned no usable road route.");
      }

      // REMOVE OLD ROUTE AND MARKERS

      clearMapMarkers();

      // DRAW ROAD ROUTE

      const roadLine = L.polyline(route, {

        color: "#1677ff",
        weight: 6,
        opacity: 0.9

      }).addTo(map);

      markers.push(roadLine);

      // START MARKER

      const startMarker = L.marker([
        a.lat,
        a.lon
      ])
        .addTo(map)
        .bindPopup("START: " + a.name);

      markers.push(startMarker);

      // DESTINATION MARKER

      const destinationMarker = L.marker([
        b.lat,
        b.lon
      ])
        .addTo(map)
        .bindPopup("DESTINATION: " + b.name);

      markers.push(destinationMarker);

      // ZOOM TO ROUTE

      map.fitBounds(roadLine.getBounds(), {
        padding: [35, 35]
      });

      // CHECK ROUTE NOTICES

      const notices = sections.flatMap(section =>
        section.notices || []
      );

      

      // ======================================

      // DETAILED VEHICLE RESTRICTION REPORT

      // ======================================

      const notices = sections.flatMap(section =>

        section.notices || []

      );

      const criticalNotices = notices.filter(notice =>

        notice.severity === "critical"

      );

      if ($("routeMessage")) {

        if (criticalNotices.length) {

          const reasons = criticalNotices.map(notice => {

            const details = notice.details || [];

            const causes = details

              .map(detail => detail.cause || detail.title)

              .filter(Boolean);

            return causes.length

              ? causes.join("; ")

              : notice.title || notice.code || "Unknown restriction";

          });

          $("routeMessage").textContent =

            "WARNING: Vehicle restriction detected. " +

            [...new Set(reasons)].join(" | ");

        } else {

          $("routeMessage").textContent =

            "Route calculated. No critical HERE restrictions reported. Check road signs before travelling.";

        }

      }
      );

      // DISPLAY ROUTE INFORMATION

      if ($("routeMessage")) {

        if (criticalNotices.length) {

          $("routeMessage").textContent =
            "Route calculated, but HERE reports a critical vehicle restriction. Check before travelling.";

        } else {

          $("routeMessage").textContent =
            "Vehicle route calculated. Check road restrictions and signs before travelling.";

        }

      }

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      toast("Coach route calculated successfully.");

    } catch (error) {

      console.error("CoachNav route error:", error);

      if ($("routeMessage")) {
        $("routeMessage").textContent = error.message;
      }

      toast(error.message);

    } finally {

      button.disabled = false;
      button.textContent = "Show route on map";

    }

  });

}

// ==========================================
// FIND CURRENT LOCATION
// ==========================================

if ($("locateMe")) {

  $("locateMe").addEventListener("click", () => {

    if (!navigator.geolocation) {
      toast("Location is not supported by this browser.");
      return;
    }

    if ($("routeMessage")) {
      $("routeMessage").textContent =
        "Requesting your location...";
    }

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

        clearMapMarkers();

        const marker = L.marker(coordinates)
          .addTo(map)
          .bindPopup("Your current location")
          .openPopup();

        markers.push(marker);

        $("origin").value = "My current location";

        if ($("routeMessage")) {
          $("routeMessage").textContent =
            "Your location is shown on the map.";
        }

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

// ==========================================
// INSTALLATION HELP
// ==========================================

if ($("installHelp")) {

  $("installHelp").addEventListener("click", () => {

    alert(
      "In Safari on your iPhone: tap the Share button, scroll down, choose Add to Home Screen, then tap Add."
    );

  });

}

// ==========================================
// APP INSTALLATION
// ==========================================

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

// ==========================================
// SERVICE WORKER
// ==========================================

if (
  "serviceWorker" in navigator &&
  location.protocol.startsWith("http")
) {

  window.addEventListener("load", () => {

    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => {

        console.warn(
          "Service worker registration failed.",
          error
        );

      });

  });

}

// ==========================================
// END OF COACHNAV APPLICATION
// ==========================================
