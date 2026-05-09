/**
 * shadow.js – Schattenberechnung & MapLibre-Layer
 *
 * Gebäude werden direkt aus den bereits gerenderten Vektorkacheln gelesen
 * (map.queryRenderedFeatures) – kein API-Aufruf, kein Warten.
 *
 * Visualisierung (invertierter Ansatz):
 *   Ein einziger GeoJSON-Layer deckt den gesamten Kartenausschnitt ab (gelb).
 *   Die Schattenpolygone werden als Löcher ausgeschnitten →
 *   Sonnenbereiche leuchten golden, Schattenbereiche zeigen die Basiskarte.
 */

const Shadow = {

  _buildings:    null,   // aktuelle Gebäude-FeatureCollection
  _lastGeoJSON:  null,   // letzte berechnete Schatten-FeatureCollection
  _zoomWarning:  false,  // Warnung bei zu kleinem Zoom angezeigt?

  // ── Gebäude aus gerenderten Kacheln lesen ─────────────────────────────────

  /**
   * Liest Gebäudegeometrien synchron aus den bereits geladenen Vektorkacheln.
   * Keine API-Anfrage nötig – Ergebnis in < 10 ms.
   *
   * @param {maplibregl.Map} map
   * @returns {Promise<GeoJSON.FeatureCollection>}  (Promise für Abwärtskompatibilität)
   */
  async loadBuildings(map) {
    this._buildings = this._fromRenderedFeatures(map);
    return this._buildings;
  },

  _fromRenderedFeatures(map) {
    const style = map.getStyle();
    if (!style) return { type: 'FeatureCollection', features: [] };

    // Alle Layer ermitteln, die 3D-Gebäude oder Gebäude-Fills enthalten
    const layerIds = style.layers
      .filter(l =>
        l.type === 'fill-extrusion' ||
        (l.type === 'fill' && (
          (l.id  || '').toLowerCase().includes('building') ||
          (l['source-layer'] || '').toLowerCase().includes('building')
        ))
      )
      // Unsere eigenen Shadow/Sun-Layer ausschliessen
      .filter(l => !l.id.includes('sun-zone') && !l.id.includes('shadow'))
      .map(l => l.id);

    if (layerIds.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    let features = [];
    try {
      features = map.queryRenderedFeatures(null, { layers: layerIds });
    } catch (e) {
      console.warn('queryRenderedFeatures fehlgeschlagen:', e);
    }

    // Nicht-Gebäude herausfiltern & auf sinnvolle Anzahl begrenzen
    const MAX = 400;
    const buildings = features
      .filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
      .filter(f => !this._isVegetation(f.properties))
      .slice(0, MAX);

    return { type: 'FeatureCollection', features: buildings };
  },

  /**
   * Gibt true zurück, wenn ein Feature Vegetation/Park/Wald ist.
   * Diese Flächen werfen keine Gebäudeschatten.
   */
  _isVegetation(p) {
    if (!p) return false;
    const nat  = (p.natural  || '').toLowerCase();
    const land = (p.landuse  || '').toLowerCase();
    const leis = (p.leisure  || '').toLowerCase();
    const amenity = (p.amenity || '').toLowerCase();
    if (['wood','tree','scrub','grassland','heath','sand','beach'].includes(nat)) return true;
    if (['forest','meadow','grass','orchard','vineyard','cemetery','farmland'].includes(land)) return true;
    if (['park','garden','pitch','common'].includes(leis)) return true;
    if (amenity === 'grave_yard') return true;
    return false;
  },

  // ── Schattenberechnung ────────────────────────────────────────────────────

  /**
   * Berechnet Schatten-GeoJSON aus geladenen Gebäuden und Sonnenposition.
   * @param {{ azimuth: number, altitude: number }} sunPos
   * @returns {GeoJSON.FeatureCollection}
   */
  calculate(sunPos) {
    const empty = { type: 'FeatureCollection', features: [] };
    if (!this._buildings?.features?.length) return empty;
    if (sunPos.altitude <= 0.017) return empty; // < 1° – Sonne am Horizont oder darunter

    const shadowLen = (h) => h / Math.tan(sunPos.altitude);

    const features = [];
    for (const f of this._buildings.features) {
      const h = this._height(f.properties);
      if (h <= 0) continue;
      const len = shadowLen(h);
      if (!isFinite(len) || len > 600) continue; // Sonne zu flach – keine sinnvollen Schatten

      if (f.geometry.type === 'Polygon') {
        const s = this._shadowForRing(f.geometry.coordinates[0], sunPos.azimuth, len);
        if (s) features.push(s);
      } else if (f.geometry.type === 'MultiPolygon') {
        for (const poly of f.geometry.coordinates) {
          const s = this._shadowForRing(poly[0], sunPos.azimuth, len);
          if (s) features.push(s);
        }
      }
    }

    this._lastGeoJSON = { type: 'FeatureCollection', features };
    return this._lastGeoJSON;
  },

  _height(props) {
    if (!props) return 9;
    // Verschiedene Eigenschaftsnamen (OSM, OpenMapTiles, Swisstopo)
    const h = parseFloat(
      props.height        ||
      props.render_height ||
      props['building:height'] || 0
    );
    if (h > 0) return Math.min(h, 250); // Realistisches Maximum
    const lvl = parseFloat(props.levels || props['building:levels'] || 0);
    if (lvl > 0) return Math.min(lvl * 3.2, 250);
    return 9; // Standardannahme: 3 Stockwerke
  },

  _shadowForRing(ring, azimuth, shadowLen) {
    if (!ring || ring.length < 4) return null;

    // Jeden Eckpunkt in Schattenrichtung verschieben
    const projected = ring.map(([lng, lat]) =>
      this._translatePoint(lng, lat, azimuth, shadowLen)
    );

    // Konvexe Hülle aus Original + Projektion (ergibt den Schattenbereich)
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
   * Verschiebt einen Punkt in Schattenrichtung.
   *
   * SunCalc-Azimut: 0=Süd, +π/2=West, -π/2=Ost
   * Schattenrichtung (entgegen der Sonne):
   *   dx_ost  = -sin(az) * länge
   *   dy_nord = -cos(az) * länge
   */
  _translatePoint(lng, lat, az, meters) {
    const mLat = 111320;
    const mLng = 111320 * Math.cos(lat * Math.PI / 180);
    return [
      lng + (-Math.sin(az) * meters / mLng),
      lat + (-Math.cos(az) * meters / mLat)
    ];
  },

  /** Graham-Scan: Konvexe Hülle in CCW-Reihenfolge. */
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
        return da !== db ? da - db
          : (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2
          - ((b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2);
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

  // ── MapLibre-Layer ────────────────────────────────────────────────────────

  /**
   * Aktualisiert alle visuellen Layer (Schatten-Overlay + Lichtquelle).
   */
  updateLayer(map, geojson, sunPos) {
    this._updateSunZoneOverlay(map, geojson, sunPos);
    this._updateSunLight(map, sunPos);
  },

  /**
   * Invertierter Ansatz:
   *   Viewport-Rechteck (gelber Sonnen-Schein) mit Schattenpolygonen als Löcher.
   *
   * GeoJSON-Konvention:
   *   Äusserer Ring (exterior) → gegen den Uhrzeigersinn (CCW)
   *   Innere Ringe (holes)     → im Uhrzeigersinn (CW)
   *
   * Die Konvexe Hülle erzeugt CCW-Ringe. Für Löcher werden diese umgekehrt → CW.
   */
  _updateSunZoneOverlay(map, geojson, sunPos) {
    const SRC = 'sun-zone-src';
    const LYR = 'sun-zone-lyr';

    const isNight = !sunPos || sunPos.altitude <= 0.017;
    let data = { type: 'FeatureCollection', features: [] };

    if (!isNight) {
      // Sichtbarer Kartenausschnitt + Randpuffer
      const b = map.getBounds();
      const pad = 0.025;
      // CCW – äusserer Ring (GeoJSON-Konvention: gegen Uhrzeiger)
      const outer = [
        [b.getWest() - pad, b.getSouth() - pad],
        [b.getEast() + pad, b.getSouth() - pad],
        [b.getEast() + pad, b.getNorth() + pad],
        [b.getWest() - pad, b.getNorth() + pad],
        [b.getWest() - pad, b.getSouth() - pad],
      ];

      // Schattenpolygone → als Löcher umkehren (CCW → CW)
      // Das ist der kritische Schritt: ohne Umkehrung werden die Löcher
      // nicht als Innenringe erkannt und der gesamte Viewport erscheint gelb.
      const holes = (geojson?.features ?? [])
        .filter(f => f.geometry?.type === 'Polygon' &&
                     f.geometry.coordinates[0]?.length >= 4)
        .map(f => {
          const ring = f.geometry.coordinates[0];
          // Sicherstellen, dass der Ring CW ist (Vorzeichen der Fläche prüfen)
          return this._signedArea(ring) > 0
            ? [...ring].reverse()   // War CCW → in CW umkehren
            : ring;                 // Schon CW
        });

      data = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [outer, ...holes] },
          properties: {}
        }]
      };
    }

    if (map.getSource(SRC)) {
      map.getSource(SRC).setData(data);
      return;
    }

    // Layer noch nicht vorhanden → anlegen, vor dem ersten Symbol-Layer einfügen
    const insertBefore = (map.getStyle()?.layers ?? []).find(l => l.type === 'symbol')?.id;
    try {
      map.addSource(SRC, { type: 'geojson', data });
      map.addLayer({
        id:  LYR,
        type: 'fill',
        source: SRC,
        paint: {
          'fill-color':   '#f5c518',
          'fill-opacity': 0.30,
        }
      }, insertBefore);
    } catch (e) {
      console.warn('Sonnen-Zone Layer konnte nicht hinzugefügt werden:', e);
    }
  },

  /**
   * Vorzeichenbehaftete Fläche (Shoelace-Formel).
   * Positiv = CCW (geografische Koordinaten, N-oben)
   * Negativ = CW
   */
  _signedArea(ring) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return a; // Positiv = CCW
  },

  /** Passt das Mapbox/MapLibre-Licht an den Sonnenstand an. */
  _updateSunLight(map, sunPos) {
    if (!sunPos || sunPos.altitude <= 0.017) {
      try { map.setLight({ anchor: 'map', color: '#8090a8', intensity: 0.15, position: [1.15, 0, 80] }); } catch (_) {}
      return;
    }
    const altDeg  = sunPos.altitude * 180 / Math.PI;
    const azDeg   = ((sunPos.azimuth * 180 / Math.PI) + 180 + 360) % 360;
    const polar   = Math.max(5, 90 - altDeg);
    const color   = altDeg < 12 ? '#ffbe6e' : '#fff9e6';
    const intensity = Math.min(0.72, 0.22 + (altDeg / 90) * 0.5);
    try { map.setLight({ anchor: 'map', color, intensity, position: [1.15, azDeg, polar] }); } catch (_) {}
  },

  // ── Punkt-in-Schatten ─────────────────────────────────────────────────────

  /**
   * Prüft ob ein Punkt im Schatten liegt.
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
