# CoachNav by Stef — free iPhone-first PWA prototype

## Included
- Luxury dark executive-coach styling
- Touring coach and double-decker profiles
- Editable height, length, width and gross-weight fields
- Local vehicle-profile saving
- OpenStreetMap map display
- Location lookup for origin and destination using Nominatim
- Current-location button (browser permission required)
- PWA manifest and service worker shell
- Driver restriction checklist and safety notice

## Important limitations
This is an early prototype, not a coach-safe navigation system.
It does **not** calculate road routes, provide turn-by-turn guidance, verify bridge heights, validate weight/axle restrictions, or guarantee access. Do not use it to navigate a live journey.

The map uses OpenStreetMap's public tile service and location search uses the public Nominatim service. These services have usage policies and are not a guaranteed free commercial backend. For a public or commercial launch, use appropriately licensed/hosted services and follow their policies. The app shell may cache locally; map tiles and geocoding require internet access.

## Run locally
A PWA requires HTTPS (or localhost). To test on a computer, serve this folder over localhost. To install on an iPhone, publish the folder to a static HTTPS host, open its URL in Safari, tap Share, then Add to Home Screen.

## Files
- `index.html` — app shell
- `styles.css` — interface styling
- `app.js` — profiles, map, location lookup and interactions
- `manifest.webmanifest` — PWA metadata
- `sw.js` — app-shell service worker
- `icon.svg` — vector app icon

## Next engineering steps
1. Add a real routing backend with a supported bus/private-bus profile.
2. Validate routing against actual UK coach restrictions and authoritative datasets.
3. Add route safety status that treats missing restriction data as unknown, never safe.
4. Add navigation SDK/voice guidance and background GPS with platform permission handling.
5. Conduct supervised road tests before any real-world use.
