/**
 * app.js – SonnenCheck Schweiz · Hauptlogik
 *
 * MapLibre GL JS mit swisstopo-Basiskarte (kein API-Token nötig).
 */

const MAP_STYLE      = 'https://tiles.openfreemap.org/styles/liberty';
const ZURICH         = { lat: 47.3769, lng: 8.5417 };
const GEOCODER_BASE  = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

// ── App-Zustand ───────────────────────────────────────────────────────────

const state = {
  lat:           ZURICH.lat,
  lng:           ZURICH.lng,
  baseDate:      new Date(),
  minutes:       getCurrentMinutes(),
  sunPos:        null,
  animating:     false,
  animTimer:     null,
  weatherHourly:     [],
  weatherCodeByHour: [],
  weatherTempByHour: [],
  popup:             null,
  mapReady:      false,
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

function getCurrentMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function currentDate() {
  return Sun.dateAtMinutes(state.baseDate, state.minutes);
}

function fmt(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── Splash-Screen ─────────────────────────────────────────────────────────

const splash = document.getElementById('splash');

function hideSplash() {
  if (splash.classList.contains('fade-out')) return;
  splash.classList.add('fade-out');
  setTimeout(() => splash.classList.add('hidden'), 750);
}

// "Jetzt erkunden"-Button
document.getElementById('btn-splash-skip').addEventListener('click', hideSplash);

// ── Karte ─────────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container:  'map',
  style:      MAP_STYLE,
  center:     [ZURICH.lng, ZURICH.lat],
  zoom:       14,
  maxBounds:  [[5.5, 45.5], [11.0, 48.2]],
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

map.on('error', err => {
  console.error('MapLibre GL Fehler:', err);
});

// Karte vollständig geladen
map.on('load', async () => {
  state.mapReady = true;

  // Schatten-Canvas initialisieren
  Shadow.initCanvas(document.getElementById('shadow-canvas'));

  // Während Karte bewegt wird: Canvas leeren (Schatten würden verrutschen)
  map.on('movestart', () => Shadow.clearCanvas());

  // Splash ausblenden (Map ist bereit)
  setTimeout(hideSplash, 400);

  // GPS anfordern
  locateUser();

  // UI initialisieren
  initDatePicker();
  initSlider();

  // Wetter laden
  loadWeather();

  // Auf Kartenbewegung reagieren (inkl. Schatten-Neuberechnung)
  map.on('moveend', onMapMoved);
});

// Favoriten sofort anzeigen – nicht erst nach Kartenstart warten
document.addEventListener('DOMContentLoaded', () => renderFavorites());

// ── GPS-Standort ──────────────────────────────────────────────────────────

function locateUser() {
  if (!navigator.geolocation) { updateView(); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.lat = pos.coords.latitude;
      state.lng = pos.coords.longitude;
      map.flyTo({ center: [state.lng, state.lat], zoom: 15 });
      reverseGeocode(state.lat, state.lng);
      updateView();
    },
    () => updateView(),
    { timeout: 8000 }
  );
}

document.getElementById('btn-locate').addEventListener('click', locateUser);

// ── Kartenbewegung ────────────────────────────────────────────────────────

let _geocodeTimer;
async function onMapMoved() {
  const c = map.getCenter();
  state.lat = c.lat;
  state.lng = c.lng;

  // Reverse geocoding gedrosselt (max. einmal alle 1.5 s)
  clearTimeout(_geocodeTimer);
  _geocodeTimer = setTimeout(() => reverseGeocode(state.lat, state.lng), 1500);

  await updateView();
}

// ── Kernfunktion: alles aktualisieren ─────────────────────────────────────

let _busy = false;

async function updateView() {
  if (!state.mapReady || _busy) return;
  _busy = true;
  try {
    const date = currentDate();
    state.sunPos = Sun.getPosition(date, state.lat, state.lng);

    // Gebäude laden + Schatten berechnen (intern für Popup-Logik)
    await Shadow.loadBuildings(map);
    const geojson = Shadow.calculate(state.sunPos);
    Shadow.updateLayer(map, geojson, state.sunPos);

    // UI
    updateStatusPill(date);
    updateSunTimes(date);
    updateWeatherForHour(Math.floor(state.minutes / 60));
  } catch (e) {
    console.error('updateView:', e);
  } finally {
    _busy = false;
  }
}

// ── Sonne/Schatten-Status-Pill ────────────────────────────────────────────

function updateStatusPill(date) {
  const pill = document.getElementById('sun-status');
  const text = document.getElementById('status-text');
  const sunUp = Sun.isUp(date, state.lat, state.lng);
  const inShad = !sunUp || Shadow.isInShadow(state.lng, state.lat);

  pill.classList.toggle('shade', inShad);

  if (text) {
    if (!sunUp) {
      text.textContent = 'Sonne unter dem Horizont';
    } else if (inShad) {
      text.textContent = 'Im Schatten';
    } else {
      const { sunset } = Sun.getDaylight(date, state.lat, state.lng);
      const remainMin = Math.round((sunset - date) / 60000);
      text.textContent = remainMin > 0
        ? `In der Sonne · noch ${remainMin} Min`
        : 'In der Sonne';
    }
  }
}

// ── Sonnenzeiten ──────────────────────────────────────────────────────────

function updateSunTimes(date) {
  const { sunrise, sunset } = Sun.getDaylight(date, state.lat, state.lng);
  const srStr = Sun.formatTime(sunrise);
  const ssStr = Sun.formatTime(sunset);

  const srEl  = document.getElementById('sunrise-time');
  const ssEl  = document.getElementById('sunset-time');
  const durEl = document.getElementById('sun-duration');
  const srLbl = document.getElementById('arc-sr-lbl');
  const ssLbl = document.getElementById('arc-ss-lbl');

  if (srEl) srEl.textContent = srStr;
  if (ssEl) ssEl.textContent = ssStr;
  if (srLbl) srLbl.textContent = srStr;
  if (ssLbl) ssLbl.textContent = ssStr;

  // Update notch positions on the arc
  if (typeof window.updateArcNotches === 'function') {
    window.updateArcNotches(
      sunrise.getHours() * 60 + sunrise.getMinutes(),
      sunset.getHours()  * 60 + sunset.getMinutes()
    );
  }

  // Remaining daylight
  if (durEl) {
    const remainMs = sunset - date;
    if (remainMs > 0 && Sun.isUp(date, state.lat, state.lng)) {
      const h = Math.floor(remainMs / 3600000);
      const m = Math.round((remainMs % 3600000) / 60000);
      durEl.textContent = h > 0
        ? `noch ${h}h ${m > 0 ? m + ' Min' : ''} Sonne`.trim()
        : `noch ${m} Min Sonne`;
    } else {
      durEl.textContent = '';
    }
  }
}

// ── Zeitschieberegler ─────────────────────────────────────────────────────

function initSlider() {
  const slider = document.getElementById('time-slider');
  slider.value = state.minutes;
  document.getElementById('time-label').textContent = fmt(state.minutes);

  let t;
  slider.addEventListener('input', () => {
    state.minutes = parseInt(slider.value, 10);
    document.getElementById('time-label').textContent = fmt(state.minutes);
    clearTimeout(t);
    t = setTimeout(updateView, 80);
  });
}

// ── Datumsauswahl ─────────────────────────────────────────────────────────

function initDatePicker() {
  const picker = document.getElementById('date-picker');
  picker.value = new Date().toISOString().slice(0, 10);
  picker.addEventListener('change', () => {
    if (picker.value) {
      state.baseDate = new Date(picker.value + 'T12:00:00');
      updateView();
    }
  });
}

// ── "Jetzt"-Button ────────────────────────────────────────────────────────

document.getElementById('btn-now').addEventListener('click', () => {
  const now = new Date();
  state.baseDate = now;
  state.minutes = clamp(now.getHours() * 60 + now.getMinutes(), 360, 1320);
  document.getElementById('time-slider').value = state.minutes;
  document.getElementById('time-label').textContent = fmt(state.minutes);
  document.getElementById('date-picker').value = now.toISOString().slice(0, 10);
  const btnTime = document.getElementById('btn-now-time');
  if (btnTime) btnTime.textContent = fmt(state.minutes);
  updateView();
});

// ── Zeitraffer-Animation ──────────────────────────────────────────────────

const btnPlay = document.getElementById('btn-play');
btnPlay.addEventListener('click', () => state.animating ? stopAnim() : startAnim());

function startAnim() {
  state.animating = true;
  btnPlay.textContent = '⏸';

  const speed = parseInt(document.getElementById('anim-speed').value, 10);
  const { sunrise } = Sun.getDaylight(new Date(state.baseDate), state.lat, state.lng);
  state.minutes = clamp(
    isNaN(sunrise?.getTime()) ? 360 : sunrise.getHours() * 60 + sunrise.getMinutes(),
    360, 1320
  );

  state.animTimer = setInterval(() => {
    state.minutes += 15 * speed;
    if (state.minutes > 1320) { stopAnim(); return; }
    document.getElementById('time-slider').value = state.minutes;
    document.getElementById('time-label').textContent = fmt(state.minutes);
    updateView();
  }, 120);
}

function stopAnim() {
  state.animating = false;
  clearInterval(state.animTimer);
  state.animTimer = null;
  btnPlay.textContent = '▶';
}

// ── Klick auf Karte → Popup ───────────────────────────────────────────────

map.on('click', e => {
  const { lng, lat } = e.lngLat;
  const date   = currentDate();
  const sunUp  = Sun.isUp(date, lat, lng);
  const inShad = sunUp && Shadow.isInShadow(lng, lat);
  const sunny  = sunUp && !inShad;

  if (state.popup) { state.popup.remove(); state.popup = null; }

  const icon  = sunny ? '☀️' : (sunUp ? '🏙️' : '🌙');
  const label = sunny ? 'Sonne' : (sunUp ? 'Im Schatten' : 'Nacht');
  const cls   = sunny ? 'sunny' : 'shaded';

  let nextHtml = '';
  if (sunny) {
    const { sunset } = Sun.getDaylight(date, lat, lng);
    const remainMs  = sunset.getTime() - date.getTime();
    if (remainMs > 0) {
      const remainMin = Math.round(remainMs / 60000);
      const h = Math.floor(remainMin / 60);
      const m = remainMin % 60;
      const dur = h > 0
        ? `${h} Std${m > 0 ? ' ' + m + ' Min' : ''}`
        : `${m} Min`;
      nextHtml = `<div class="popup-next">☀️ Noch ${dur} Sonne</div>`;
    }
  }

  const html = `
    <div class="popup-head">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title ${cls}">${label}</span>
    </div>
    <div class="popup-detail">
      ${fmt(state.minutes)} Uhr · ${date.toLocaleDateString('de-CH')}
    </div>
    ${nextHtml}
  `;

  state.popup = new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
    .setLngLat([lng, lat])
    .setHTML(html)
    .addTo(map);
});

map.on('dragstart', () => {
  if (state.popup) { state.popup.remove(); state.popup = null; }
});

// ── Ortssuche ─────────────────────────────────────────────────────────────

const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { hideResults(); return; }
  searchTimer = setTimeout(() => doSearch(q), 280);
});

searchInput.addEventListener('blur', () => setTimeout(hideResults, 200));

async function doSearch(q) {
  try {
    const url = `${GEOCODER_BASE}?searchText=${encodeURIComponent(q)}&type=locations&lang=de&sr=4326&limit=6`;
    const r = await safeFetch(url, 5000);
    showResults(r.results || []);
  } catch { hideResults(); }
}

function showResults(results) {
  if (!results.length) { hideResults(); return; }
  searchResults.innerHTML = results.map(r => {
    const a = r.attrs || {};
    const label = (a.label || '').replace(/<\/?[^>]+>/g, '');
    return `<div class="search-item" tabindex="0" data-lat="${a.lat}" data-lng="${a.lon}">${label}</div>`;
  }).join('');
  searchResults.style.display = 'block';

  searchResults.querySelectorAll('.search-item').forEach(item => {
    item.addEventListener('click',   () => pickResult(item));
    item.addEventListener('keydown', e => { if (e.key === 'Enter') pickResult(item); });
  });
}

function pickResult(item) {
  const lat = parseFloat(item.dataset.lat);
  const lng = parseFloat(item.dataset.lng);
  if (isNaN(lat) || isNaN(lng)) return;
  state.lat = lat; state.lng = lng;
  map.flyTo({ center: [lng, lat], zoom: 15 });
  document.getElementById('location-name').textContent = item.textContent.trim().split(',')[0];
  hideResults();
  searchInput.value = '';
  updateView();
}

function hideResults() {
  searchResults.style.display = 'none';
  searchResults.innerHTML = '';
}

// ── Reverse Geocoding ─────────────────────────────────────────────────────

async function reverseGeocode(lat, lng) {
  try {
    const url = `${GEOCODER_BASE}?searchText=${lat.toFixed(4)},${lng.toFixed(4)}&type=locations&lang=de&sr=4326&limit=1`;
    const r = await safeFetch(url, 4000);
    const label = r.results?.[0]?.attrs?.label;
    if (label) {
      const clean = label.replace(/<\/?[^>]+>/g, '').split(',')[0].trim();
      document.getElementById('location-name').textContent = clean;
    }
  } catch { /* silent */ }
}

// ── Wetter ────────────────────────────────────────────────────────────────

async function loadWeather() {
  const result = await Weather.get(state.lat, state.lng);
  state.weatherHourly     = result.cloudCoverByHour  || [];
  state.weatherCodeByHour = result.weatherCodeByHour || [];
  state.weatherTempByHour = result.temperatureByHour || [];
  updateWeatherForHour(Math.floor(state.minutes / 60));
}

function updateWeatherForHour(hour) {
  const code = Weather.atHour(state.weatherCodeByHour, hour);
  const temp = Weather.atHour(state.weatherTempByHour, hour);
  const { icon } = Weather.describeCode(code);
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('weather-text').textContent = temp !== null ? `${Math.round(temp)}°` : '—';
}

// ── Favoriten ─────────────────────────────────────────────────────────────

document.getElementById('btn-fav-save').addEventListener('click', () => {
  const name = document.getElementById('location-name').textContent || 'Mein Ort';
  Favorites.save(name, state.lat, state.lng);
  renderFavorites();
  const btn = document.getElementById('btn-fav-save');
  btn.textContent = '★'; btn.classList.add('saved');
  setTimeout(() => { btn.textContent = '☆'; btn.classList.remove('saved'); }, 1500);
});

function renderFavorites() {
  const list = document.getElementById('favorites-list');
  const favs = Favorites.getAll();
  if (!favs.length) {
    list.innerHTML = '<p class="no-favorites">Noch keine Favoriten gespeichert.</p>';
    return;
  }
  list.innerHTML = favs.map(f => `
    <div class="fav-chip" role="listitem">
      <span>⭐ ${f.name}</span>
      <button class="fav-del" data-lat="${f.lat}" data-lng="${f.lng}" aria-label="${f.name} aufrufen">→</button>
      <button class="fav-del" data-del="${f.id}" aria-label="${f.name} löschen">×</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-lat]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.lat = parseFloat(btn.dataset.lat);
      state.lng = parseFloat(btn.dataset.lng);
      map.flyTo({ center: [state.lng, state.lat], zoom: 15 });
      updateView();
    });
  });

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      Favorites.delete(btn.dataset.del);
      renderFavorites();
    });
  });
}

// ── URL-Parameter beim Start laden (Share-Link) ───────────────────────────

(function loadFromURL() {
  const p = new URLSearchParams(location.search);
  const lat = parseFloat(p.get('lat'));
  const lng = parseFloat(p.get('lng'));
  const min = parseInt(p.get('t'), 10);
  const ds  = p.get('d');
  if (!isNaN(lat) && !isNaN(lng)) { state.lat = lat; state.lng = lng; map.setCenter([lng, lat]); }
  if (!isNaN(min)) state.minutes = clamp(min, 360, 1320);
  if (ds) state.baseDate = new Date(ds + 'T12:00:00');
})();

// ── Impressum Modal ───────────────────────────────────────────────────────

document.getElementById('btn-impressum').addEventListener('click', () => {
  document.getElementById('impressum-overlay').removeAttribute('hidden');
});

document.getElementById('btn-impressum-close').addEventListener('click', () => {
  document.getElementById('impressum-overlay').setAttribute('hidden', '');
});

document.getElementById('impressum-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget)
    e.currentTarget.setAttribute('hidden', '');
});

// ── fetch-Wrapper mit Timeout ─────────────────────────────────────────────

async function safeFetch(url, ms) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  } finally {
    clearTimeout(tid);
  }
}
