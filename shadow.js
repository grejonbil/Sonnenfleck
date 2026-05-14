/**
 * shadow.js – Sonnenfleck · Schattenberechnung & Canvas-Overlay
 *
 * NEUE LOGIK (invertiert gegenüber Vorversion):
 * ─────────────────────────────────────────────
 * Statt Schatten dunkel zu zeichnen, wird die gesamte Karte mit einer
 * dunklen Maske überdeckt. Dann werden die SONNIGEN Flächen (= alles
 * ausserhalb der Schattenpolygone) warm-gelb hervorgehoben ("Sonnenleck").
 *
 * Technisch: Zwei-Pass-Canvas-Rendering
 *   Pass 1 – Offscreen-Canvas: Schattenpolygone als solide Flächen zeichnen
 *   Pass 2 – Sichtbarer Canvas:
 *     a) Gesamte Karte dunkel überdecken (= Schatten-Zustand als Default)
 *     b) Pixel die im Offscreen NICHT gefüllt sind = sonnig → warm einfärben
 *        via globalCompositeOperation = 'destination-out' + Sonnenschein-Gradient
 *
 * Einfacher erklärt:
 *   - Dunkle Maske über alles
 *   - Schattenpolygone "stempeln" die Maske weg → darunter kommt die Karte sauber durch
 *   - WARTE: das wäre falsch (Schatten = hell, Sonne = dunkel)
 *
 * Korrekte Umsetzung mit drei Passes:
 *   Offscreen A: Schattenpolygone solid zeichnen (= wo Schatten ist)
 *   Sichtbar:
 *     1. Gesamte Fläche dunkel füllen
 *     2. Offscreen A als Maske benutzen: destination-out → wo Schatten ist,
 *        Maske entfernen (= Schatten wird hell/neutral = Karte sichtbar)
 *     3. Dann: Sonnige Flächen (= wo Maske noch steht) mit Gelb einfärben
 *
 *   Das ergibt: Sonnige Flächen = warm gelb-orange überlagert
 *               Schattige Flächen = normale Karte, leicht abgedunkelt
 */
const Shadow = {

  _buildings:   null,   // aktuelle Gebäude-FeatureCollection
  _lastGeoJSON: null,   // berechnete Schatten-Polygone (für isInShadow)
  _canvas:      null,   // sichtbarer <canvas> über der Karte
  _ctx:         null,   // 2D-Context des sichtbaren Canvas
  _offscreen:   null,   // Offscreen-Canvas für Schatten-Maske
  _offCtx:      null,   // 2D-Context des Offscreen-Canvas

  // ── Canvas-Setup ──────────────────────────────────────────────────────

  /**
   * Einmalig nach DOM-Aufbau aufrufen.
   * @param {HTMLCanvasElement} canvasEl – das sichtbare Canvas über der Karte
   */
  initCanvas(canvasEl) {
    this._canvas = canvasEl;
    this._ctx    = canvasEl.getContext('2d');

    // Offscreen-Canvas (gleiche Grösse, nicht im DOM)
    this._offscreen = document.createElement('canvas');
    this._offCtx    = this._offscreen.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());
  },

  _resize() {
    if (!this._canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._canvas.width      = w;
    this._canvas.height     = h;
    this._offscreen.width   = w;
    this._offscreen.height  = h;
  },

  /** Löscht alle Overlays (z.B. während des Kartenpannens). */
  clearCanvas() {
    if (!this._ctx) return;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._offCtx.clearRect(0, 0, this._offscreen.width, this._offscreen.height);
  },

  // ── Gebäude laden ────────────────────────────────────────────────────

  /**
   * Liest Gebäude- und Waldgeometrien aus den bereits gerenderten Kacheln.
   * Keine Netzwerkanfrage – Ergebnis in < 10 ms.
   */
  async loadBuildings(map) {
    this._buildings = this._fromRenderedFeatures(map);
    return this._buildings;
  },

  _fromRenderedFeatures(map) {
    const style = map.getStyle();
    if (!style) return { type: 'FeatureCollection', features: [] };

    const layers = style.layers ?? [];
    const canvas = map.getCanvas();
    const bbox   = [[0, 0], [canvas.clientWidth, canvas.clientHeight]];

    // 3D-Gebäude-Layer (fill-extrusion) und 2D-Gebäude-Fill-Layer
    const bldIds = layers
      .filter(l =>
        l.type === 'fill-extrusion' ||
        (l.type === 'fill' && (
          (l.id || '').toLowerCase().includes('building') ||
          (l['source-layer'] || '').toLowerCase().includes('building')
        ))
      )
      .filter(l => !l.id.includes('sun-zone') && !l.id.includes('shadow'))
      .map(l => l.id);

    // Wald/Park-Polygon-Layer (für Baumschatten)
    const vegIds = layers
      .filter(l => l.type === 'fill' && (
        (l.id || '').toLowerCase().match(/wood|forest|park|natur|green/) ||
        (l['source-layer'] || '').toLowerCase().match(/landcover|landuse/)
      ))
      .filter(l => !l.id.includes('sun-zone') && !l.id.includes('shadow'))
      .map(l => l.id);

    let buildings = [], vegetation = [];

    try {
      if (bldIds.length) {
        buildings = map.queryRenderedFeatures(bbox, { layers: bldIds })
          .filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
          .filter(f => !this._isVegetation(f.properties));
      }
    } catch (e) { console.warn('Gebäude queryRenderedFeatures:', e); }

    try {
      if (vegIds.length) {
        vegetation = map.queryRenderedFeatures(bbox, { layers: vegIds })
          .filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
          .filter(f => this._isForestOrWood(f.properties))
          .map(f => ({
            ...f,
            properties: { ...f.properties, _treeHeight: this._treeHeight(f.properties) }
          }));
      }
    } catch (e) { console.warn('Vegetation queryRenderedFeatures:', e); }

    return {
      type: 'FeatureCollection',
      features: [
        ...buildings.slice(0, 350),
        ...vegetation.slice(0, 80)
      ]
    };
  },

  _isVegetation(p) {
    if (!p) return false;
    const nat  = (p.natural  || '').toLowerCase();
    const land = (p.landuse  || '').toLowerCase();
    const leis = (p.leisure  || '').toLowerCase();
    return ['wood','tree','scrub','grassland','heath','sand'].includes(nat) ||
           ['forest','meadow','grass','orchard','farmland'].includes(land) ||
           ['park','garden','pitch'].includes(leis);
  },

  _isForestOrWood(p) {
    if (!p) return false;
    const nat  = (p.natural  || '').toLowerCase();
    const land = (p.landuse  || '').toLowerCase();
    const cls  = (p.class    || '').toLowerCase();
    return nat === 'wood' || land === 'forest' ||
           cls === 'wood' || cls  === 'forest';
  },

  _treeHeight(p) {
    if (!p) return 14;
    const h = parseFloat(p.height || 0);
    if (h > 0) return Math.min(h, 30);
    return 14; // typische Stadtbaum-Höhe CH
  },

  // ── Schattenberechnung ───────────────────────────────────────────────

  calculate(sunPos) {
    const empty = { type: 'FeatureCollection', features: [] };
    if (!this._buildings?.features?.length) return empty;
    if (sunPos.altitude <= 0.017) return empty; // Sonne unter ~1°

    const features = [];

    for (const f of this._buildings.features) {
      const isTree = !!f.properties?._treeHeight;
      const h = isTree
        ? f.properties._treeHeight
        : this._bldHeight(f.properties);
      if (h <= 0) continue;

      const shadowLen = h / Math.tan(sunPos.altitude);
      if (!isFinite(shadowLen) || shadowLen > 800) continue;

      if (f.geometry.type === 'Polygon') {
        const s = this._shadowForRing(f.geometry.coordinates[0], sunPos.azimuth, shadowLen);
        if (s) features.push(s);
      } else if (f.geometry.type === 'MultiPolygon') {
        for (const poly of f.geometry.coordinates) {
          const s = this._shadowForRing(poly[0], sunPos.azimuth, shadowLen);
          if (s) features.push(s);
        }
      }
    }

    this._lastGeoJSON = { type: 'FeatureCollection', features };
    return this._lastGeoJSON;
  },

  _bldHeight(props) {
    if (!props) return 9;
    const h = parseFloat(props.height || props.render_height || props['building:height'] || 0);
    if (h > 0) return Math.min(h, 250);
    const lvl = parseFloat(props.levels || props['building:levels'] || 0);
    if (lvl > 0) return Math.min(lvl * 3.2, 250);
    return 9; // Fallback: 3-stöckiges Gebäude
  },

  _shadowForRing(ring, azimuth, shadowLen) {
    if (!ring || ring.length < 4) return null;
    const projected = ring.map(([lng, lat]) =>
      this._translate(lng, lat, azimuth, shadowLen)
    );
    const all  = [...ring.slice(0, -1), ...projected.slice(0, -1)];
    const hull = this._convexHull(all);
    if (hull.length < 3) return null;
    hull.push(hull[0]);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [hull] }, properties: {} };
  },

  /**
   * SunCalc-Azimut: 0 = Süd, +π/2 = West, −π/2 = Ost
   * Schattenrichtung = entgegengesetzt zur Sonne
   */
  _translate(lng, lat, az, m) {
    const mLat = 111320;
    const mLng = 111320 * Math.cos(lat * Math.PI / 180);
    return [
      lng - Math.sin(az) * m / mLng,
      lat - Math.cos(az) * m / mLat
    ];
  },

  _convexHull(pts) {
    if (pts.length <= 3) return pts.slice();
    const pivot = pts.reduce((p, c) =>
      c[1] < p[1] || (c[1] === p[1] && c[0] < p[0]) ? c : p);
    const sorted = pts.filter(p => p !== pivot).sort((a, b) => {
      const da = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
      const db = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
      return da !== db ? da - db
        : (a[0]-pivot[0])**2+(a[1]-pivot[1])**2
        - ((b[0]-pivot[0])**2+(b[1]-pivot[1])**2);
    });
    const hull = [pivot];
    for (const p of sorted) {
      while (hull.length > 1 && this._cross(hull[hull.length-2], hull[hull.length-1], p) <= 0)
        hull.pop();
      hull.push(p);
    }
    return hull;
  },

  _cross(O, A, B) {
    return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0]);
  },

  // ── Canvas-Rendering (NEUE LOGIK) ────────────────────────────────────

  /**
   * Haupt-Update: Schattenberechnung → Canvas zeichnen → MapLibre-Licht.
   * Wird von app.js nach jeder Zeitänderung aufgerufen.
   */
  updateLayer(map, geojson, sunPos) {
    this._drawSunshine(map, geojson, sunPos);
    this._updateSunLight(map, sunPos);

    // Eventuelle alte GeoJSON-Layer aus früheren Versionen aufräumen
    ['sun-zone-lyr', 'shadow-layer'].forEach(id => {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch(_) {}
    });
    ['sun-zone-src', 'shadow-source'].forEach(id => {
      try { if (map.getSource(id)) map.removeSource(id); } catch(_) {}
    });
  },

  /**
   * KERN DER NEUEN LOGIK – Drei-Pass-Rendering:
   *
   * Pass 1 (Offscreen): Schattenpolygone solid zeichnen
   *   → weiss gefüllte Polygone = wo Schatten liegt
   *
   * Pass 2 (Sichtbar):
   *   a) Gesamte Fläche mit dunkler Schatten-Farbe füllen
   *   b) Offscreen als Maske benutzen (destination-out):
   *      Wo im Offscreen weiss = Schatten → Maske entfernen (= Karte normal sichtbar)
   *      Wo im Offscreen leer  = sonnig   → Maske bleibt (= sonnige Flächen sehen
   *                                          die dunkle Farbe – aber wir wollen WARM!)
   *
   * Pass 3 (Sichtbar, source-over):
   *   Sonnige Flächen (= wo Offscreen leer) mit warmem Gelb-Orange einfärben
   *   → globalCompositeOperation = 'destination-atop' über den Offscreen
   *
   * Vereinfacht als einziger korrekter Ablauf:
   *
   *   Sichtbarer Canvas:
   *     1. Alles mit warmem Sonnen-Gelb füllen (= Sonne = Default)
   *     2. Schattenpolygone in dunklem Blau-Grau zeichnen (übermalt das Gelb)
   *     3. Canvas-Opacity via CSS kontrolliert die Sichtbarkeit
   *
   * → Das ist die einfachste und robusteste Lösung ohne Compositing-Fallstricke.
   *   Sonnige Flächen = warm gelb-orange
   *   Schattige Flächen = kühles Dunkelblau
   *   Karte selbst bleibt immer sichtbar (Canvas-Opacity ~0.45)
   */
  _drawSunshine(map, shadows, sunPos) {
    if (!this._ctx) return;
    this._resize();

    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Night: nothing (clean basemap)
    if (!sunPos || sunPos.altitude <= 0.017) return;

    // Sun strength 0–1 based on altitude (full at 45°+)
    const altDeg   = sunPos.altitude * 180 / Math.PI;
    const strength = Math.min(1, altDeg / 45);

    // Warm sunshine colour: orange at horizon, yellow-gold at zenith
    const sunR = 255;
    const sunG = Math.round(185 + strength * 55);  // 185 → 240
    const sunB = Math.round(20  + strength * 25);  // 20  → 45
    const sunA = (0.42 + strength * 0.20).toFixed(2); // 0.42 → 0.62

    // ── Pass 1: fill entire canvas with warm sunshine tint ───────────
    const cx = W / 2, cy = H / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.72);
    grad.addColorStop(0, `rgba(${sunR}, ${sunG}, ${sunB}, ${sunA})`);
    grad.addColorStop(1, `rgba(${sunR}, ${Math.max(150, sunG - 45)}, ${sunB}, ${(parseFloat(sunA) * 0.62).toFixed(2)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── Pass 2: erase shadow polygons with destination-out ───────────
    // Result: warm tint survives only on SUNNY pixels; shadow areas
    //         become fully transparent → clean basemap shows through.
    if (!shadows?.features?.length) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();

    for (const f of shadows.features) {
      const rings = f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates[0]]
        : f.geometry.coordinates.map(p => p[0]);

      for (const ring of rings) {
        if (!ring || ring.length < 3) continue;
        const p0 = map.project([ring[0][0], ring[0][1]]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < ring.length; i++) {
          const p = map.project([ring[i][0], ring[i][1]]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
      }
    }

    ctx.fill('nonzero');
    ctx.globalCompositeOperation = 'source-over'; // reset
  },

  /**
   * Passt die MapLibre-Lichtquelle an den Sonnenstand an (3D-Gebäude).
   * Gibt sonnigem Licht eine warme, schattiger Zeit eine kühle Farbe.
   */
  _updateSunLight(map, sunPos) {
    if (!sunPos || sunPos.altitude <= 0.017) {
      try {
        map.setLight({
          anchor:    'map',
          color:     '#8090a8',
          intensity: 0.15,
          position:  [1.15, 0, 80]
        });
      } catch(_) {}
      return;
    }

    const altDeg  = sunPos.altitude * 180 / Math.PI;
    const azDeg   = ((sunPos.azimuth * 180 / Math.PI) + 180 + 360) % 360;
    const polar   = Math.max(5, 90 - altDeg);
    const color   = altDeg < 12 ? '#ffbe6e' : '#fff9e6';
    const intensity = Math.min(0.75, 0.22 + (altDeg / 90) * 0.53);

    try {
      map.setLight({ anchor: 'map', color, intensity, position: [1.15, azDeg, polar] });
    } catch(_) {}
  },

  // ── Punkt-in-Schatten (für Popup & Status-Pill) ──────────────────────

  /**
   * Prüft ob ein geografischer Punkt im Schatten liegt.
   * Verwendet die zuletzt berechneten Schattenpolygone.
   * @param {number} lng
   * @param {number} lat
   * @returns {boolean}
   */
  isInShadow(lng, lat) {
    if (!this._lastGeoJSON?.features) return false;
    for (const f of this._lastGeoJSON.features) {
      if (f.geometry.type === 'Polygon' &&
          this._pip([lng, lat], f.geometry.coordinates[0])) return true;
    }
    return false;
  },

  /** Point-in-Polygon (Ray-Casting). */
  _pip([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }

};