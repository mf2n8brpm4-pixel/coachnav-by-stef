const profiles={
 touring:{height:"3.80",length:"12.00",width:"2.55",weight:"18"},
 double:{height:"4.30",length:"12.00",width:"2.55",weight:"18"}
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
 try{localStorage.setItem('coachnav_profiles',JSON.stringify(profiles))}catch(e){}
 toast('Vehicle profile saved on this device.');
});
try{const saved=JSON.parse(localStorage.getItem('coachnav_profiles')||'null');if(saved){Object.assign(profiles,saved);setProfile('touring')}}catch(e){}
async function geocode(q){
 const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q);
 const res=await fetch(url,{headers:{'Accept':'application/json'}});
 if(!res.ok)throw new Error('Location service unavailable');
 const data=await res.json();if(!data.length)throw new Error('Could not find: '+q);
 return {lat:Number(data[0].lat),lon:Number(data[0].lon),name:data[0].display_name};
}
$('previewRoute').addEventListener('click',async()=>{
 const from=$('origin').value.trim(),to=$('destination').value.trim();
 if(!from||!to){toast('Enter both a starting point and destination.');return}
 $('previewRoute').disabled=true;$('previewRoute').textContent='Finding locations…';
 $('routeMessage').textContent='Looking up the two locations. This may take a few seconds.';
 try{
  const a=await geocode(from);await new Promise(r=>setTimeout(r,1100));const b=await geocode(to);
  markers.forEach(m=>map.removeLayer(m));markers=[];
  markers.push(L.marker([a.lat,a.lon]).addTo(map).bindPopup('START · '+a.name));
  markers.push(L.marker([b.lat,b.lon]).addTo(map).bindPopup('DESTINATION · '+b.name));
  const bounds=L.latLngBounds([[a.lat,a.lon],[b.lat,b.lon]]);map.fitBounds(bounds,{padding:[35,35],maxZoom:12});
  $('routeMessage').textContent='Both locations found and shown on the map. No road route has been calculated; this is not navigation.';
  toast('Locations displayed. No safe route has been calculated.');
 }catch(e){$('routeMessage').textContent=e.message+' Please check the spelling and try again.';toast(e.message)}
 finally{$('previewRoute').disabled=false;$('previewRoute').innerHTML='Show locations on map <span>↗</span>'}
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
