/**
 * shadow.js – Schattenberechnung & MapLibre-Layer-Management
 *
 * Schritte:
 * 1. Gebäude-GeoJSON laden (Swisstopo WFS → Overpass Fallback)
 * 2. Für jedes Gebäude den Schattenpolygon berechnen (Konvexe Hülle)
 * 3. Ergebnis als MapLibre-Fill-Layer rendern
 */

const Shadow = {

  // ── Interne Caches ───────────────────────────────────────────────────────

  _buildings: null,        // zuletzt geladene Gebäude-FeatureCollection
  _lastGeoJSON: null,      // zuletzt berechnete Schatten-FeatureCollection
  _buildingCache: {},      // Cache: Kachel-Key → GeoJSON

  // ── Gebäude laden ────────────────────────────────────────────────────────

  /**
   * Lädt Gebäude für den aktuellen Karten-Ausschnitt.
   * Strategie: Swisstopo WFS → Overpass API Fallback.
   * Ergebnisse werden 30 Minuten in localStorage gecacht.
   *
   * @param {maplibregl.Map} map
   * @returns {Promise<GeoJSON.FeatureCollection>}
   */
  async loadBuildings(map) {
    const bounds = map.getBounds();
    const cacheKey = this._boundsKey(bounds);

    // 1. Memory-Cache
    if (this._buildingCache[cacheKey]) {
      this._buildings = this._buildingCache[cacheKey];
      return this._buildings;
    }

    // 2. localStorage-Cache (30 Min.)
    const stored = this._readCache(cacheKey);
    if (stored) {
      this._buildings = stored;
      this._buildingCache[cacheKey] = stored;
      return stored;
    }

    // 3. Swisstopo WFS versuchen
    try {
      const data = await this._fetchSwisstopo(bounds);
      if (data && data.features && data.features.length > 0) {
        this._saveCache(cacheKey, data);
        this._buildingCache[cacheKey] = data;
        this._buildings = data;
        return data;
      }
    } catch (_) {
      // TODO: CORS – Swisstopo WFS erlaubt keine direkten Browser-Anfragen
    }

    // 4. Overpass-Fallback
    try {
      const data = await this._fetchOverpass(bounds);
      this._saveCache(cacheKey, data);
      this._buildingCache[cacheKey] = data;
      this._buildings = data;
      return data;
    } catch (err) {
      console.warn('Gebäudedaten konnten nicht geladen werden:', err);
      return { type: 'FeatureCollection', features: [] };
    }
  },

  /** Erzeugt einen Cache-Key aus dem Map-Ausschnitt (gerundet auf ~500m). */
  _boundsKey(bounds) {
    const r = n => Math.round(n * 200) / 200; // ~500m Genauigkeit
    return `${r(bounds.getWest())},${r(bounds.getSouth())},${r(bounds.getEast())},${r(bounds.getNorth())}`;
  },

  _readCache(key) {
    try {
      const raw = localStorage.getItem('bld_' + key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < 30 * 60 * 1000) return data;
    } catch (_) {}
    return null;
  },

  _saveCache(key, data) {
    try {
      localStorage.setItem('bld_' + key, JSON.stringify({ ts: Date.now(), data }));
    } catch (_) {}
  },

  // ── Datenabrufe ──────────────────────────────────────────────────────────

  async _fetchSwisstopo(bounds) {
    // TODO: CORS – Swisstopo WFS blockiert direkte Browser-Anfragen häufig
    const w = bounds.getWest(), s = bounds.getSouth(),
          e = bounds.getEast(), n = bounds.getNorth();
    const url = `https://wfs.geo.admin.ch/?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
      `&TYPENAMES=ch.swisstopo.swissbuildings3d_2_gebaeude_footprint` +
      `&SRSNAME=EPSG:4326&BBOX=${s},${w},${n},${e}` +
      `&outputFormat=application/json&count=500`;
    return this._fetchJSON(url, 4000);
  },

  async _fetchOverpass(bounds) {
    const w = bounds.getWest().toFixed(6), s = bounds.getSouth().toFixed(6),
          e = bounds.getEast().toFixed(6), n = bounds.getNorth().toFixed(6);
    const query = `[out:json][bbox:${s},${w},${n},${e}];(way["building"];);out body geom;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const data = await this._fetchJSON(url, 12000);
    return this._overpassToGeoJSON(data);
  },

  async _fetchJSON(url, ms) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    } finally {
      clearTimeout(tid);
    }
  },

  _overpassToGeoJSON(data) {
    const features = [];
    for (const el of data.elements || []) {
      if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue;
      const coords = el.geometry.map(p => [p.lon, p.lat]);
      // GeoJSON-Ring schließen
      if (coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
      }
      const tags = el.tags || {};
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { ...tags, height_m: this._height(tags) }
      });
    }
    return { type: 'FeatureCollection', features };
  },

  // ── Schattenberechnung ───────────────────────────────────────────────────

  /**
   * Berechnet Schatten-GeoJSON für alle geladenen Gebäude.
   * @param {{ azimuth: number, altitude: number }} sunPos
   * @returns {GeoJSON.FeatureCollection}
   */
  calculate(sunPos) {
    const empty = { type: 'FeatureCollection', features: [] };
    if (!this._buildings || !this._buildings.features) return empty;
    if (sunPos.altitude <= 0.017) return empty; // Sonne unter / am Horizont (< 1°)

    const features = [];
    for (const f of this._buildings.features) {
      const h = this._height(f.properties);
      if (h <= 0) continue;
      const shadow = this._shadowForFeature(f, sunPos, h);
      if (shadow) features.push(shadow);
    }

    this._lastGeoJSON = { type: 'FeatureCollection', features };
    return this._lastGeoJSON;
  },

  /** Liest die Gebäudehöhe aus OSM- oder Swisstopo-Attributen. */
  _height(props) {
    if (!props) return 9;
    const h = parseFloat(props.height || props['building:height'] || 0);
    if (h > 0) return h;
    const lvl = parseFloat(props.levels || props['building:levels'] || 0);
    if (lvl > 0) return lvl * 3.2;
    return 9; // Standardannahme: 3 Stockwerke
  },

  _shadowForFeature(feature, sunPos, height) {
    const geom = feature.geometry;
    if (!geom || geom.type !== 'Polygon') return null;

    const ring = geom.coordinates[0];
    if (!ring || ring.length < 4) return null;

    // Schattenlänge auf dem Boden (Meter)
    const shadowLen = height / Math.tan(sunPos.altitude);
    if (!isFinite(shadowLen) || shadowLen > 500) return null; // Sonne zu flach

    // Jeden Eckpunkt in Schattenrichtung verschieben
    const projected = ring.map(([lng, lat]) =>
      this._translatePoint(lng, lat, sunPos.azimuth, shadowLen)
    );

    // Konvexe Hülle aus Original + projizierten Punkten
    const allPts = [...ring.slice(0, -1), ...projected.slice(0, -1)];
    const hull = this._convexHull(allPts);
    if (hull.length < 3) return null;

    hull.push(hull[0]); // Ring schließen

    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [hull] },
      properties: {}
    };
  },

  /**
   * Verschiebt einen Punkt in Schattenrichtung (entgegengesetzt zur Sonne).
   *
   * SunCalc-Azimut-Konvention: 0=Süd, +π/2=West, -π/2=Ost
   *
   * Schattenrichtung:
   *   dx (Ost)  = -sin(azimuth) * länge / metersPerLng
   *   dy (Nord) = -cos(azimuth) * länge / metersPerLat
   *
   * Beweis: Sonne im Süden (az=0) → Schatten nach Norden (dy > 0) ✓
   *         Sonne im Osten (az=-π/2) → Schatten nach Westen (dx < 0) ✓
   */
  _translatePoint(lng, lat, azimuth, meters) {
    const mPerLat = 111320;
    const mPerLng = 111320 * Math.cos(lat * Math.PI / 180);
    const dx = -Math.sin(azimuth) * meters / mPerLng;
    const dy = -Math.cos(azimuth) * meters / mPerLat;
    return [lng + dx, lat + dy];
  },

  /** Konvexe Hülle via Graham-Scan (O(n log n)). */
  _convexHull(pts) {
    if (pts.length <= 3) return pts.slice();
    const pivot = pts.reduce((p, c) =>
      c[1] < p[1] || (c[1] === p[1] && c[0] < p[0]) ? c : p
    );
    const sorted = pts
      .filter(p => p !== pivot)
      .sort((a, b) => {
        const da = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
        const db = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
        if (da !== db) return da - db;
        return (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2 -
               ((b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2);
      });
    const hull = [pivot];
    for (const p of sorted) {
      while (hull.length > 1 && this._cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0)
        hull.pop();
      hull.push(p);
    }
    return hull;
  },

  _cross(O, A, B) {
    return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  },

  // ── Karten-Layer & Beleuchtung ───────────────────────────────────────────

  /**
   * Aktualisiert Sonnenbeleuchtung und 3D-Gebäude.
   * Schatten-GeoJSON wird nur intern für isInShadow() verwendet, nicht gezeichnet.
   * @param {mapboxgl.Map}              map
   * @param {GeoJSON.FeatureCollection} geojson   – Schatten-Polygone (intern)
   * @param {{ azimuth: number, altitude: number }} sunPos
   */
  updateLayer(map, geojson, sunPos) {
    // Alten Shadow-Layer entfernen falls vorhanden (Legacy)
    if (map.getLayer('shadow-layer'))  map.removeLayer('shadow-layer');
    if (map.getSource('shadow-source')) map.removeSource('shadow-source');

    this._updateSunLight(map, sunPos);
    this._update3DBuildings(map);
  },

  /** Setzt die Mapbox-Lichtquelle auf die echte Sonnenposition. */
  _updateSunLight(map, sunPos) {
    if (!sunPos || sunPos.altitude <= 0.017) {
      // Nacht: kühles Dämmerlicht
      map.setLight({ anchor: 'map', color: '#8090a8', intensity: 0.18, position: [1.15, 0, 80] });
      return;
    }
    // SunCalc: 0=Süd, +π/2=West → Mapbox-Azimut: 0=Nord, +90=Ost
    const azDeg    = ((sunPos.azimuth * 180 / Math.PI) + 180 + 360) % 360;
    const altDeg   = sunPos.altitude * 180 / Math.PI;
    // Mapbox polar: 0=Zenit, 90=Horizont
    const polar    = Math.max(5, 90 - altDeg);
    // Warm-orange bei flacher Sonne, weißlich bei hohem Stand
    const color    = altDeg < 12 ? '#ffbe6e' : '#fff9e6';
    const intensity = Math.min(0.7, 0.22 + (altDeg / 90) * 0.48);
    map.setLight({ anchor: 'map', color, intensity, position: [1.15, azDeg, polar] });
  },

  /** Fügt 3D-Gebäude aus eigenem GeoJSON (Overpass/swisstopo) hinzu oder aktualisiert sie. */
  _update3DBuildings(map) {
    const SRC = 'buildings-3d-src';
    const LYR = 'buildings-3d-lyr';
    if (!this._buildings) return;

    try {
      if (map.getSource(SRC)) {
        map.getSource(SRC).setData(this._buildings);
        return;
      }
      const layers = map.getStyle()?.layers ?? [];
      const firstSymbol = layers.find(l => l.type === 'symbol');
      map.addSource(SRC, { type: 'geojson', data: this._buildings });
      map.addLayer({
        id: LYR,
        type: 'fill-extrusion',
        source: SRC,
        paint: {
          'fill-extrusion-color': '#d4cbb8',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            14.5, ['coalesce', ['get', 'height_m'], 9]
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88
        }
      }, firstSymbol?.id);
    } catch (err) {
      console.warn('3D-Gebäude konnten nicht hinzugefügt werden:', err);
    }
  },

  // ── Punkt-in-Schatten-Prüfung ────────────────────────────────────────────

  /**
   * Prüft, ob ein Punkt innerhalb eines Schattenpolygons liegt.
   * @param {number} lng
   * @param {number} lat
   * @returns {boolean}
   */
  isInShadow(lng, lat) {
    if (!this._lastGeoJSON) return false;
    for (const f of this._lastGeoJSON.features) {
      if (f.geometry.type === 'Polygon' &&
          this._pip([lng, lat], f.geometry.coordinates[0])) return true;
    }
    return false;
  },

  /** Ray-casting Point-in-Polygon. */
  _pip([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
};
