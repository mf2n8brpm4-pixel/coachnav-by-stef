const profiles={
 touring:{height:"3.90",length:"15.00",width:"2.55",weight:"26"},
 double:{height:"4.40",length:"15.00",width:"2.55",weight:"26"}
};
let currentProfile="touring";
const $=id=>document.getElementById(id);
const map=L.map('map',{zoomControl:false}).setView([51.5074,-0.1278],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
let markers=[];
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3200)}
function setProfile(name){
 currentProfile=name;
 document.querySelectorAll('.vehicle-option').forEach(b=>b.classList.toggle('selected',b.dataset.profile===name));
 const p=profiles[name];['height','length','width','weight'].forEach(k=>$(k).value=p[k]);
}
document.querySelectorAll('.vehicle-option').forEach(b=>b.addEventListener('click',()=>setProfile(b.dataset.profile)));
$('saveVehicle').addEventListener('click',()=>{
 const p={};let valid=true;
 ['height','length','width','weight'].forEach(k=>{p[k]=$(k).value;if(!p[k]||Number(p[k])<=0)valid=false});
 if(!valid){toast('Please enter valid vehicle dimensions.');return}
 profiles[currentProfile]=p;
 try{localStorage.setItem('coachnav_profiles_v2',JSON.stringify(profiles))}catch(e){}
 toast('Vehicle profile saved on this device.');
});
try{const saved=JSON.parse(localStorage.getItem('coachnav_profiles_v2')||'null');if(saved){Object.assign(profiles,saved);setProfile('touring')}}catch(e){}
async function geocode(q){
 const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q);
 const res=await fetch(url,{headers:{'Accept':'application/json'}});
 if(!res.ok)throw new Error('Location service unavailable');
 const data=await res.json();if(!data.length)throw new Error('Could not find: '+q);
 return {lat:Number(data[0].lat),lon:Number(data[0].lon),name:data[0].display_name};
}function decodeHerePolyline(encoded) {

  let index = 0, lat = 0, lon = 0;

  const points = [];

  function readValue() {

    let result = 0, shift = 0, value;

    do {

      value = encoded.charCodeAt(index++) - 63;

      result |= (value & 0x1f) << shift;

      shift += 5;

    } while (value >= 0x20);

    return (result & 1) ? ~(result >> 1) : (result >> 1);

  }

  const header = encoded.charCodeAt(index++) - 63;

  const precision = Math.pow(10, -(header & 15));

  const thirdDim = (header >> 4) & 7;

  if (thirdDim) {

    const thirdPrecision = Math.pow(

      10,

      -((encoded.charCodeAt(index++) - 63) & 15)

    );

  }

  while (index < encoded.length) {

    lat += readValue();

    lon += readValue();

    points.push([lat * precision, lon * precision]);

    if (thirdDim) readValue();

  }

  return points;

}
$('previewRoute').addEventListener('click', async e => {

  e.preventDefault();

  const from = $('origin').value.trim();

  const to = $('destination').value.trim();

  if (!from || !to) {

    toast('Enter both a starting point and destination.');

    return;

  }

  $('previewRoute').disabled = true;

  $('previewRoute').textContent = 'Calculating route...';

  $('routeMessage').textContent = 'Finding coach route...';

  try {

    const a = await geocode(from);

    const b = await geocode(to);

    const p = profiles[currentProfile];

    const params = new URLSearchParams({

      transportMode: 'truck',

      origin: `${a.lat},${a.lon}`,

      destination: `${b.lat},${b.lon}`,

      routingMode: 'fast',

      return: 'polyline,summary',

      'vehicle[height]': String(Math.round(Number(p.height) * 100)),

      'vehicle[length]': String(Math.round(Number(p.length) * 100)),

      'vehicle[width]': String(Math.round(Number(p.width) * 100)),

      'vehicle[grossWeight]': String(Math.round(Number(p.weight) * 1000)),

      apiKey: 'Fav5zkRAQl0p63_T0GEfk79RfI5P9Wag6fmeI-fnHsE'

    });

    const response = await fetch(

      'https://router.hereapi.com/v8/routes?' + params

    );

    const data = await response.json();

    if (!response.ok) {

      throw new Error(data.cause || data.title || 'HERE routing failed.');

    }

    if (!data.routes || !data.routes.length) {

      throw new Error('No route found for this vehicle.');

    }

    const sections = data.routes[0].sections;

    const route = [];

    sections.forEach(section => {

      if (section.polyline) {

        route.push(...decodeHerePolyline(section.polyline));

      }

    });

    if (!route.length) {

      throw new Error('HERE returned no route line.');

    }

    markers.forEach(m => map.removeLayer(m));

    markers = [];

    const roadLine = L.polyline(route, {

      color: '#1677ff',

      weight: 6

    }).addTo(map);

    markers.push(roadLine);

    markers.push(

      L.marker([a.lat, a.lon]).addTo(map)

        .bindPopup('START: ' + a.name)

    );

    markers.push(

      L.marker([b.lat, b.lon]).addTo(map)

        .bindPopup('DESTINATION: ' + b.name)

    );

    map.fitBounds(roadLine.getBounds(), { padding: [35, 35] });

    $('routeMessage').textContent =

      'HERE truck route calculated for your selected vehicle profile. Check all restrictions before travelling.';

  } catch (e) {

    $('routeMessage').textContent = e.message;

    toast(e.message);

  } finally {

    $('previewRoute').disabled = false;

    $('previewRoute').textContent = 'Show route on map';

  }

});

  e.preventDefault();

  const from = $('origin').value.trim();

  const to = $('destination').value.trim();

  if (!from || !to) {

    toast('Enter both a starting point and destination.');

    return;

  }

  $('previewRoute').disabled = true;

  $('previewRoute').textContent = 'Calculating route...';

  $('routeMessage').textContent = 'Finding road route...';

  try {

    const a = await geocode(from);

    const b = await geocode(to);

    const url =

      `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;

    const response = await fetch(url);

    const data = await response.json();

    if (!data.routes || !data.routes.length) {

      throw new Error('No road route found.');

    }

    markers.forEach(m => map.removeLayer(m));

    markers = [];

    const route = data.routes[0].geometry.coordinates

      .map(p => [p[1], p[0]]);

    const roadLine = L.polyline(route, {

      color: '#1677ff',

      weight: 6

    }).addTo(map);

    markers.push(roadLine);

    markers.push(

      L.marker([a.lat, a.lon]).addTo(map)

        .bindPopup('START: ' + a.name)

    );

    markers.push(

      L.marker([b.lat, b.lon]).addTo(map)

        .bindPopup('DESTINATION: ' + b.name)

    );

    map.fitBounds(roadLine.getBounds(), {

      padding: [35, 35]

    });

    $('routeMessage').textContent =

      'Road route preview calculated. Not validated for coach restrictions.';

  } catch (e) {

    $('routeMessage').textContent = e.message;

    toast(e.message);

  } finally {

    $('previewRoute').disabled = false;

    $('previewRoute').textContent = 'Show route on map';

  }

});
$('locateMe').addEventListener('click',()=>{
 if(!navigator.geolocation){toast('Location is not supported by this browser.');return}
 $('routeMessage').textContent='Requesting your location…';
 navigator.geolocation.getCurrentPosition(pos=>{
  const ll=[pos.coords.latitude,pos.coords.longitude];map.setView(ll,14);
  L.marker(ll).addTo(map).bindPopup('Your current location').openPopup();
  $('origin').value='My current location';$('routeMessage').textContent='Your location is shown on the map. Location access is only used when you request it.';
 },()=>toast('Could not access location. Check iPhone location permissions.'),{enableHighAccuracy:true,timeout:12000});
});
$('installHelp').addEventListener('click',()=>alert('In Safari on your iPhone: tap the Share button, scroll down, choose “Add to Home Screen”, then tap Add. The app must first be hosted on a secure HTTPS website.'));
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
