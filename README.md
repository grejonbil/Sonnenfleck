# SonnenCheck Schweiz

Interaktive Schattenkarte für die Schweiz. Zeigt auf Basis astronomisch berechneter Sonnenpositionen und Gebäudedaten, welche Orte zu einem bestimmten Zeitpunkt in der Sonne oder im Schatten liegen.

[Live Demo](https://grejonbil.github.io/Sonnenfleck/)

---

## Lokale Entwicklung

Kein Build-System nötig, nur ein Browser.

**Direkt öffnen**

```bash
git clone https://github.com/grejonbil/Sonnenfleck.git
cd Sonnenfleck
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

> Manche APIs (Swisstopo WFS, Geolocation) funktionieren nur über HTTPS oder `localhost`. Für vollständige Funktionalität einen lokalen Server verwenden.

**Lokaler Dev-Server**

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .
```

---

## APIs und Datenquellen

| Komponente | Quelle |
|---|---|
| Karte | [OpenFreeMap / MapLibre](https://openfreemap.org/) |
| Gebäudedaten (primär) | [Swisstopo WFS](https://www.geo.admin.ch/) |
| Gebäudedaten (Fallback) | [OpenStreetMap / Overpass API](https://overpass-api.de/) |
| Sonnenberechnung | [SunCalc.js](https://github.com/mourner/suncalc) |
| Wetter | [Open-Meteo](https://open-meteo.com/) |
| Ortssuche | [Swisstopo GeoAdmin](https://api3.geo.admin.ch/) |

Betriebskosten: CHF 0 / Monat

---

## Projektstruktur

```
SonnenCheck/
├── index.html      – Einstiegspunkt & HTML-Struktur
├── style.css       – Mobile-first Styles
├── app.js          – Hauptlogik & Kartensteuerung
├── sun.js          – Sonnenberechnung (SunCalc-Wrapper)
├── shadow.js       – Schattenberechnung & MapLibre-Layer
├── weather.js      – Open-Meteo API-Integration
├── favorites.js    – LocalStorage-Favoritenverwaltung
├── manifest.json   – PWA Web App Manifest
└── LICENSE
```

---

## Schattenberechnung

1. **SunCalc.js** berechnet Azimut und Elevationswinkel der Sonne für Koordinaten und Zeitpunkt.
2. **Swisstopo WFS** (oder Overpass-Fallback) liefert Gebäudeumrisse mit Höhenangaben.
3. Schattenlänge pro Gebäude: `Höhe / tan(Elevationswinkel)`
4. Der Schattenpolygon ist die konvexe Hülle aus Gebäude-Fussabdruck und projiziertem Fussabdruck.
5. **MapLibre GL JS** rendert die Polygone als Layer auf der Karte.

---

## Browser-Unterstützung

iOS Safari 16+, Android Chrome 110+, Chrome / Edge / Firefox (Desktop). Internet Explorer wird nicht unterstützt.

---

## Lizenz

MIT – siehe [LICENSE](LICENSE)
