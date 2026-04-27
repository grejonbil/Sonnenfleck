/**
 * app.js – SonnenCheck Schweiz · Hauptlogik
 *
 * Aufbau:
 *  1. Karte initialisieren (MapLibre + Swisstopo-Stil)
 *  2. GPS-Standort abfragen (Fallback: Zürich)
 *  3. Gebäude laden → Schatten berechnen → Layer rendern
 *  4. Zeitschieberegler, Datumsauswahl, Animation
 *  5. Klick auf Karte → Sonne/Schatten-Popup
 *  6. Ortssuche (Swisstopo GeoAdmin API)
 *  7. Favoriten
 */

// ── Konstanten ────────────────────────────────────────────────────────────────

const ZURICH = { lat: 47.3769, lng: 8.5417 };
const MAP_STYLE = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.leichte-basiskarte.vt/style.json';
const GEOCODER_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

// ── App-Zustand ────────────────────────────────────────────────────────────────

const state = {
  lat:        ZURICH.lat,
  lng:        ZURICH.lng,
  baseDate:   new Date(),       // Datum (ohne Uhrzeit)
  minutes:    getCurrentMinutes(),  // Minuten seit Mitternacht
  sunPos:     null,
  animating:  false,
  animTimer:  null,
  weatherHourly: [],
  popup:      null,
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function clampMinutes(m) {
  return Math.min(1320, Math.max(360, m));
}

function currentDate() {
  return Sun.dateAtMinutes(state.baseDate, state.minutes);
}

function formatMinutes(m) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}

// ── Karte ─────────────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [ZURICH.lng, ZURICH.lat],
  zoom: 15,
  maxBounds: [[5.9, 45.8], [10.6, 47.85]], // Schweiz-Bounding-Box
  attributionControl: { compact: true }
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

// ── Karte geladen ─────────────────────────────────────────────────────────────

map.on('load', async () => {
  // GPS-Standort anfordern
  locateUser();

  // UI initialisieren
  initDatePicker();
  initSlider();
  renderFavorites();

  // Wetter laden
  loadWeather();

  // Karte reagiert auf Bewegung → Gebäude neu laden
  map.on('moveend', onMapMoved);

  // Lade-Overlay ausblenden
  document.getElementById('loading').classList.add('hidden');
});

// ── GPS & Standort ────────────────────────────────────────────────────────────

function locateUser() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      state.lat = pos.coords.latitude;
      state.lng = pos.coords.longitude;
      map.flyTo({ center: [state.lng, state.lat], zoom: 15 });
      reverseGeocode(state.lat, state.lng);
      updateView();
    },
    _err => {
      // GPS verweigert → Zürich als Fallback
      updateView();
    },
    { timeout: 8000 }
  );
}

document.getElementById('btn-locate').addEventListener('click', locateUser);

// ── Karte bewegt ──────────────────────────────────────────────────────────────

async function onMapMoved() {
  const center = map.getCenter();
  state.lat = center.lat;
  state.lng = center.lng;
  await updateView();
}

// ── Kernfunktion: Schatten + UI aktualisieren ─────────────────────────────────

let _updatePending = false;

async function updateView() {
  if (_updatePending) return;
  _updatePending = true;

  try {
    const date = currentDate();
    state.sunPos = Sun.getPosition(date, state.lat, state.lng);

    // Gebäude laden & Schatten berechnen
    await Shadow.loadBuildings(map);
    const shadowGeoJSON = Shadow.calculate(state.sunPos);
    Shadow.updateLayer(map, shadowGeoJSON);

    // Sun-Status-Pill aktualisieren
    updateSunStatus(date);

    // Sonnenauf-/-untergang
    updateSunTimes(date);

    // Wetter-Stunde synchronisieren
    updateWeatherForHour(Math.floor(state.minutes / 60));
  } catch (err) {
    console.error('updateView fehlgeschlagen:', err);
  } finally {
    _updatePending = false;
  }
}

// ── Sun-Status-Pill ───────────────────────────────────────────────────────────

function updateSunStatus(date) {
  const pill = document.getElementById('sun-status');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');

  const sunUp = Sun.isUp(date, state.lat, state.lng);
  if (!sunUp) {
    pill.className = 'shaded';
    icon.textContent = '🌙';
    text.textContent = 'Sonne unter dem Horizont';
    return;
  }

  // Mittelpunkt-Schatten prüfen
  const inShadow = Shadow.isInShadow(state.lng, state.lat);
  pill.className = inShadow ? 'shaded' : 'sunny';
  icon.textContent = inShadow ? '🌑' : '☀️';
  text.textContent = inShadow ? 'Im Schatten' : 'In der Sonne';
}

// ── Sonnenzeiten ──────────────────────────────────────────────────────────────

function updateSunTimes(date) {
  const { sunrise, sunset } = Sun.getDaylight(date, state.lat, state.lng);
  const el = document.getElementById('sun-times');
  el.textContent = `🌅 ${Sun.formatTime(sunrise)}  🌇 ${Sun.formatTime(sunset)}`;
}

// ── Zeitschieberegler ─────────────────────────────────────────────────────────

function initSlider() {
  const slider = document.getElementById('time-slider');
  slider.value = state.minutes;
  document.getElementById('time-label').textContent = formatMinutes(state.minutes);

  let debounceTimer;
  slider.addEventListener('input', () => {
    state.minutes = parseInt(slider.value, 10);
    document.getElementById('time-label').textContent = formatMinutes(state.minutes);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateView(), 80);
  });
}

// ── Datumsauswahl ─────────────────────────────────────────────────────────────

function initDatePicker() {
  const picker = document.getElementById('date-picker');
  const today = new Date();
  picker.value = today.toISOString().slice(0, 10);

  picker.addEventListener('change', () => {
    if (picker.value) {
      state.baseDate = new Date(picker.value + 'T12:00:00');
      updateView();
    }
  });
}

// ── "Jetzt"-Schaltfläche ──────────────────────────────────────────────────────

document.getElementById('btn-now').addEventListener('click', () => {
  const now = new Date();
  state.baseDate = now;
  state.minutes = clampMinutes(now.getHours() * 60 + now.getMinutes());

  document.getElementById('time-slider').value = state.minutes;
  document.getElementById('time-label').textContent = formatMinutes(state.minutes);
  document.getElementById('date-picker').value = now.toISOString().slice(0, 10);

  updateView();
});

// ── Zeitraffer-Animation ──────────────────────────────────────────────────────

const btnPlay = document.getElementById('btn-play');

btnPlay.addEventListener('click', () => {
  if (state.animating) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

function startAnimation() {
  state.animating = true;
  btnPlay.textContent = '⏸';
  btnPlay.setAttribute('aria-label', 'Animation stoppen');

  const speed = parseInt(document.getElementById('anim-speed').value, 10);
  const STEP_MIN = 15;       // 15-Minuten-Schritte
  const INTERVAL_MS = 120;   // ms pro Schritt

  // Starte immer bei Sonnenaufgang
  const date0 = new Date(state.baseDate);
  const { sunrise } = Sun.getDaylight(date0, state.lat, state.lng);
  state.minutes = clampMinutes(
    isNaN(sunrise.getTime()) ? 360 :
    sunrise.getHours() * 60 + sunrise.getMinutes()
  );

  state.animTimer = setInterval(() => {
    state.minutes += STEP_MIN * speed;
    if (state.minutes > 1320) {
      stopAnimation();
      return;
    }

    const slider = document.getElementById('time-slider');
    slider.value = state.minutes;
    document.getElementById('time-label').textContent = formatMinutes(state.minutes);
    updateView();
  }, INTERVAL_MS);
}

function stopAnimation() {
  state.animating = false;
  clearInterval(state.animTimer);
  state.animTimer = null;
  btnPlay.textContent = '▶';
  btnPlay.setAttribute('aria-label', 'Zeitraffer starten');
}

// ── Klick auf Karte → Popup ───────────────────────────────────────────────────

map.on('click', e => {
  const { lng, lat } = e.lngLat;
  const date = currentDate();
  const sunUp = Sun.isUp(date, lat, lng);
  const inShadow = sunUp ? Shadow.isInShadow(lng, lat) : true;

  if (state.popup) { state.popup.remove(); state.popup = null; }

  const isSunny = sunUp && !inShadow;
  const icon  = isSunny ? '☀️' : (sunUp ? '🌑' : '🌙');
  const label = isSunny ? 'Sonne' : (sunUp ? 'Schatten' : 'Nacht');
  const cls   = isSunny ? 'sunny' : 'shaded';

  let nextHtml = '';
  // Nächsten Wechsel berechnen (nur wenn Sonne oben)
  if (sunUp) {
    const nextChange = Sun.findNextChange(
      date,
      d => Shadow.isInShadow(lng, lat),
      lat, lng,
      inShadow
    );
    if (nextChange) {
      const verb = inShadow ? 'Sonne ab' : 'Schatten ab';
      nextHtml = `<div class="popup-next">${verb} ${Sun.formatTime(nextChange)} Uhr</div>`;
    }
  }

  const html = `
    <div class="popup-head">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title ${cls}">${label}</span>
    </div>
    <div class="popup-detail">
      ${formatMinutes(state.minutes)} Uhr · ${date.toLocaleDateString('de-CH')}
    </div>
    ${nextHtml}
  `;

  state.popup = new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
    .setLngLat([lng, lat])
    .setHTML(html)
    .addTo(map);
});

// Popup schließen bei Kartenbewegung
map.on('dragstart', () => { if (state.popup) { state.popup.remove(); state.popup = null; } });

// ── Ortssuche ─────────────────────────────────────────────────────────────────

const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) { hideSearchResults(); return; }
  searchTimer = setTimeout(() => doSearch(q), 280);
});

searchInput.addEventListener('blur', () => {
  setTimeout(hideSearchResults, 200);
});

async function doSearch(query) {
  const url = `${GEOCODER_URL}?searchText=${encodeURIComponent(query)}` +
    `&type=locations&lang=de&sr=4326&limit=6`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    showSearchResults(data.results || []);
  } catch (_) {
    hideSearchResults();
  }
}

function showSearchResults(results) {
  if (!results.length) { hideSearchResults(); return; }
  searchResults.innerHTML = results.map(r => {
    const attrs = r.attrs || {};
    const label = attrs.label?.replace(/<\/?[^>]+>/g, '') || 'Unbekannt';
    return `<div class="search-item" tabindex="0"
              data-lat="${attrs.lat}" data-lng="${attrs.lon}">
              ${label}
            </div>`;
  }).join('');
  searchResults.style.display = 'block';

  searchResults.querySelectorAll('.search-item').forEach(item => {
    item.addEventListener('click', () => selectSearchResult(item));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter') selectSearchResult(item);
    });
  });
}

function selectSearchResult(item) {
  const lat = parseFloat(item.dataset.lat);
  const lng = parseFloat(item.dataset.lng);
  if (isNaN(lat) || isNaN(lng)) return;

  state.lat = lat;
  state.lng = lng;
  map.flyTo({ center: [lng, lat], zoom: 15 });
  document.getElementById('location-name').textContent =
    item.textContent.trim().split(',')[0];
  hideSearchResults();
  searchInput.value = '';
  updateView();
}

function hideSearchResults() {
  searchResults.style.display = 'none';
  searchResults.innerHTML = '';
}

// ── Reverse Geocoding ─────────────────────────────────────────────────────────

async function reverseGeocode(lat, lng) {
  const url = `${GEOCODER_URL}?searchText=${lat.toFixed(4)},${lng.toFixed(4)}` +
    `&type=locations&lang=de&sr=4326&limit=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const label = data.results?.[0]?.attrs?.label;
    if (label) {
      const clean = label.replace(/<\/?[^>]+>/g, '').split(',')[0].trim();
      document.getElementById('location-name').textContent = clean;
    }
  } catch (_) {}
}

// ── Wetter ────────────────────────────────────────────────────────────────────

async function loadWeather() {
  const result = await Weather.get(state.lat, state.lng);
  state.weatherHourly = result.cloudCoverByHour || [];
  updateWeatherForHour(Math.floor(state.minutes / 60));
}

function updateWeatherForHour(hour) {
  const pct = Weather.cloudAtHour(state.weatherHourly, hour);
  const { icon, text } = Weather.describe(pct);
  document.getElementById('weather-icon').textContent = icon;
  document.getElementById('weather-text').textContent = pct !== null ? `${Math.round(pct)}%` : text;
}

// ── Favoriten ─────────────────────────────────────────────────────────────────

document.getElementById('btn-fav-save').addEventListener('click', () => {
  const name = document.getElementById('location-name').textContent || 'Mein Ort';
  Favorites.save(name, state.lat, state.lng);
  renderFavorites();

  const btn = document.getElementById('btn-fav-save');
  btn.textContent = '★';
  btn.classList.add('saved');
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
      <button class="fav-del"
        data-id="${f.id}" data-lat="${f.lat}" data-lng="${f.lng}"
        aria-label="${f.name} aufrufen">→</button>
      <button class="fav-del"
        data-del="${f.id}"
        aria-label="${f.name} löschen">×</button>
    </div>
  `).join('');

  // Favorit aufrufen
  list.querySelectorAll('[data-lat]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      state.lat = lat;
      state.lng = lng;
      map.flyTo({ center: [lng, lat], zoom: 15 });
      updateView();
    });
  });

  // Favorit löschen
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      Favorites.delete(btn.dataset.del);
      renderFavorites();
    });
  });
}

// ── Share-Link (COULD HAVE) ───────────────────────────────────────────────────

// URL-Parameter beim Start verarbeiten
(function loadFromURL() {
  const params = new URLSearchParams(location.search);
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  const min = parseInt(params.get('t'), 10);
  const dateStr = params.get('d');

  if (!isNaN(lat) && !isNaN(lng)) {
    state.lat = lat;
    state.lng = lng;
    map.setCenter([lng, lat]);
  }
  if (!isNaN(min)) state.minutes = clampMinutes(min);
  if (dateStr) state.baseDate = new Date(dateStr + 'T12:00:00');
})();
