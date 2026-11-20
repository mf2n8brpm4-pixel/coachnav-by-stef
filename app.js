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

let currentRoute = null;

const $ = id => document.getElementById(id);

// ==========================================

// LOAD SAVED VEHICLES

// ==========================================

try {

  const saved = JSON.parse(

    localStorage.getItem("coachnav_profiles_v2") || "null"

  );

  if (saved) {

    ["touring", "double"].forEach(name => {

      if (saved[name]) {

        profiles[name] = {

          ...profiles[name],

          ...saved[name]

        };

      }

    });

  }

  const selected = localStorage.getItem(

    "coachnav_selected_profile_v1"

  );

  if (profiles[selected]) {

    currentProfile = selected;

  }

} catch (error) {

  console.warn("Could not load vehicle profiles.", error);

}

// ==========================================

// MAP SETUP

// ==========================================

if (typeof L === "undefined" || !$("map")) {

  throw new Error(

    "CoachNav map could not start. Check that Leaflet is loaded and the map element exists."

  );

}

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

  if (!el) {

    console.log(message);

    return;

  }

  el.textContent = message;

  el.classList.add("show");

  setTimeout(() => {

    el.classList.remove("show");

  }, 3200);

}

// ==========================================

// MAP CLEANUP

// ==========================================

function clearMapMarkers() {

  markers.forEach(marker => {

    if (map.hasLayer(marker)) {

      map.removeLayer(marker);

    }

  });

  markers = [];

  currentRoute = null;

}

// ==========================================

// SAVE PROFILES

// ==========================================

function saveProfiles() {

  try {

    localStorage.setItem(

      "coachnav_profiles_v2",

      JSON.stringify(profiles)

    );

    localStorage.setItem(

      "coachnav_selected_profile_v1",

      currentProfile

    );

    return true;

  } catch (error) {

    console.warn("Could not save profiles.", error);

    return false;

  }

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

  try {

    localStorage.setItem(

      "coachnav_selected_profile_v1",

      name

    );

  } catch (error) {

    console.warn("Could not save selected vehicle.");

  }

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

      const value = field ? field.value.trim() : "";

      if (

        !value ||

        !Number.isFinite(Number(value)) ||

        Number(value) <= 0

      ) {

        valid = false;

      }

      profile[key] = value;

    });

    if (!valid) {

      toast("Please enter valid vehicle dimensions.");

      return;

    }

    profiles[currentProfile] = profile;

    if (saveProfiles()) {

      toast("Vehicle profile saved on this device.");

    } else {

      toast("Could not save vehicle profile.");

    }

  });

}

// ==========================================

// RESTORE SELECTED VEHICLE

// ==========================================

setProfile(currentProfile);

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

        throw new Error("HERE polyline value too large.");

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

  const version = decodeUnsignedVarint();

  if (version !== 1) {

    throw new Error("Unsupported HERE polyline version.");

  }

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

// VEHICLE RESTRICTION REPORT

// ==========================================

function getRestrictionReport(routeData, sections) {

  const notices = [

    ...(routeData.notices || []),

    ...sections.flatMap(section => section.notices || [])

  ];

  const uniqueNotices = [

    ...new Map(

      notices.map(notice => [

        JSON.stringify(notice),

        notice

      ])

    ).values()

  ];

  const critical = uniqueNotices.filter(

    notice => notice.severity === "critical"

  );

  const informative = uniqueNotices.filter(

    notice => notice.severity === "info"

  );

  if (critical.length) {

    const reasons = critical.map(notice => {

      const details = (notice.details || []).map(detail => {

        const limits = [];

        if (detail.maxHeight != null) {

          limits.push(

            "Maximum height: " + detail.maxHeight + " cm"

          );

        }

        if (detail.maxWidth != null) {

          limits.push(

            "Maximum width: " + detail.maxWidth + " cm"

          );

        }

        if (detail.maxLength != null) {

          limits.push(

            "Maximum length: " + detail.maxLength + " cm"

          );

        }

        if (detail.maxGrossWeight != null) {

          limits.push(

            "Maximum gross weight: " +

            detail.maxGrossWeight + " kg"

          );

        }

        return [

          detail.cause,

          detail.title,

          ...limits

        ].filter(Boolean).join(" - ");

      });

      return [

        notice.title,

        notice.code,

        ...details

      ].filter(Boolean).join(": ");

    });

    return {

      critical: true,

      verified: false,

      message:

        "WARNING: HERE reports critical vehicle restrictions. " +

        [...new Set(reasons)].join(" | ")

    };

  }

  let message =

    "HERE returned no critical restriction notices. " +

    "This does NOT guarantee that every bridge, road or vehicle restriction has been identified. " +

    "Always check official restrictions and roadside signs before travelling.";

  if (informative.length) {

    message +=

      " Additional notices: " +

      informative.map(n => n.title || n.code).join("; ");

  }

  return {

    critical: false,

    verified: false,

    message

  };

}

// ==========================================

// GET CURRENT VEHICLE DIMENSIONS

// ==========================================

function getCurrentVehicle() {

  const profile = {

    height: $("height")?.value.trim(),

    length: $("length")?.value.trim(),

    width: $("width")?.value.trim(),

    weight: $("weight")?.value.trim()

  };

  const valid = [

    "height",

    "length",

    "width",

    "weight"

  ].every(key =>

    Number.isFinite(Number(profile[key])) &&

    Number(profile[key]) > 0

  );

  if (!valid) {

    throw new Error("Please check your vehicle dimensions.");

  }

  return profile;

}

// ==========================================

// CALCULATE COACH ROUTE

// ==========================================

if ($("previewRoute")) {

  $("previewRoute").addEventListener("click", async event => {

    event.preventDefault();

    const from = $("origin")?.value.trim();

    const to = $("destination")?.value.trim();

    if (!from || !to) {

      toast("Enter both a starting point and destination.");

      return;

    }

    if (!HERE_API_KEY) {

      toast("Check your HERE API key.");

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

      // START LOCATION

      const a =

        from === "My current location" && currentLocation

          ? currentLocation

          : await geocode(from);

      // DESTINATION

      const b = await geocode(to);

      // VEHICLE PROFILE

      const profile = getCurrentVehicle();

      profiles[currentProfile] = profile;

      saveProfiles();

      // HERE ROUTING REQUEST

      const params = new URLSearchParams();

      params.set("transportMode", "truck");

      params.set("origin", `${a.lat},${a.lon}`);

      params.set("destination", `${b.lat},${b.lon}`);

      params.set("routingMode", "fast");

      params.set("return", "polyline,summary");

      params.set("spans", "notices");

      // VEHICLE DIMENSIONS IN CENTIMETRES

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

      // GROSS WEIGHT IN KILOGRAMS

      params.set(

        "vehicle[grossWeight]",

        String(Math.round(Number(profile.weight) * 1000))

      );

      params.set("apiKey", HERE_API_KEY);

      // SEND REQUEST

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

      if (!response.ok) {

        throw new Error(

          data.cause ||

          data.title ||

          data.message ||

          "HERE routing request failed."

        );

      }

      if (!data.routes || !data.routes.length) {

        throw new Error("HERE could not find a route.");

      }

      // ROUTE SECTIONS

      const routeData = data.routes[0];

      const sections = routeData.sections || [];

      const route = [];

      sections.forEach(section => {

        if (section.polyline) {

          route.push(

            ...decodeHerePolyline(section.polyline)

          );

        }

      });

      if (route.length < 2) {

        throw new Error("HERE returned no usable road route.");

      }

      // CLEAR OLD ROUTE

      clearMapMarkers();

      // DRAW ROUTE

      const roadLine = L.polyline(route, {

        color: "#1677ff",

        weight: 6,

        opacity: 0.9

      }).addTo(map);

      markers.push(roadLine);

      currentRoute = roadLine;

      // START MARKER

      markers.push(

        L.marker([a.lat, a.lon])

          .addTo(map)

          .bindPopup("START: " + a.name)

      );

      // DESTINATION MARKER

      markers.push(

        L.marker([b.lat, b.lon])

          .addTo(map)

          .bindPopup("DESTINATION: " + b.name)

      );

      // FIT MAP

      map.fitBounds(roadLine.getBounds(), {

        padding: [35, 35]

      });

      // DISTANCE AND TIME

      const summary = sections.reduce(

        (result, section) => {

          if (section.summary) {

            result.length += section.summary.length || 0;

            result.duration += section.summary.duration || 0;

          }

          return result;

        },

        {

          length: 0,

          duration: 0

        }

      );

      // RESTRICTION REPORT

      const report = getRestrictionReport(

        routeData,

        sections

      );

      let message = report.message;

      message +=

        " Vehicle: " +

        (currentProfile === "double"

          ? "Double-decker"

          : "Touring coach") +

        ". Height: " + profile.height +

        "m. Width: " + profile.width +

        "m. Length: " + profile.length +

        "m. Gross weight: " + profile.weight +

        " tonnes.";

      if (summary.length > 0) {

        message +=

          " Distance: " +

          (summary.length / 1000).toFixed(1) +

          " km.";

      }

      if (summary.duration > 0) {

        message +=

          " Estimated driving time: " +

          Math.round(summary.duration / 60) +

          " minutes.";

      }

      if ($("routeMessage")) {

        $("routeMessage").textContent = message;

      }

      setTimeout(() => {

        map.invalidateSize();

      }, 200);

      toast(

        report.critical

          ? "Route calculated. Check vehicle restrictions."

          : "Coach route calculated. Check restrictions before travelling."

      );

      console.log("CoachNav route:", data);

      console.log("Vehicle profile:", profile);

      console.log("Restriction report:", report);

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

        markers.push(

          L.marker(coordinates)

            .addTo(map)

            .bindPopup("Your current location")

            .openPopup()

        );

        if ($("origin")) {

          $("origin").value = "My current location";

        }

        if ($("routeMessage")) {

          $("routeMessage").textContent =

            "Your location is shown on the map.";

        }

      },

      error => {

        console.warn("Location error:", error);

        toast(

          "Could not access location. Check iPhone location permissions."

        );

      },

      {

        enableHighAccuracy: true,

        timeout: 12000,

        maximumAge: 0

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

      "In Safari on your iPhone:\n\n" +

      "1. Tap the Share button.\n" +

      "2. Scroll down.\n" +

      "3. Choose Add to Home Screen.\n" +

      "4. Tap Add."

    );

  });

}

// ==========================================

// APP INSTALLATION

// ==========================================

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", event => {

  event.preventDefault();

  deferredPrompt = event;

  if ($("installBtn")) {

    $("installBtn").hidden = false;

  }

});

if ($("installBtn")) {

  $("installBtn").addEventListener("click", async () => {

    if (!deferredPrompt) {

      toast("Use Safari Share and Add to Home Screen.");

      return;

    }

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

// INITIALISE MAP SIZE

// ==========================================

window.addEventListener("load", () => {

  setTimeout(() => {

    map.invalidateSize();

  }, 300);

});

// ==========================================

// END OF COACHNAV BY STEF

// ==========================================
