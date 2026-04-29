# ☀️ SonnenCheck Schweiz

**Wo scheint die Sonne gerade? Echtzeit-Schattenkarte für die Schweiz.**

SonnenCheck kombiniert astronomisch präzise Sonnenberechnungen mit Gebäudedaten und zeigt dir auf einer interaktiven Karte, ob dein Lieblingsplatz – die Terrasse, das Seeufer oder der Stadtpark – gerade in der Sonne liegt oder im Schatten liegt.

👉 **[Live Demo](https://grejonbil.github.io/Sonnenfleck/)**

---

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-396CB2?logo=maplibre&logoColor=white)
![SunCalc](https://img.shields.io/badge/SunCalc.js-F5C518)
![Open-Meteo](https://img.shields.io/badge/Open--Meteo-4A9BC7)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Status |
|---|---|
| Interaktive Swisstopo-Karte (Schweiz) | ✅ |
| Gebäudeschatten in Echtzeit | ✅ |
| Zeitschieberegler (06:00–22:00) | ✅ |
| Zeitraffer-Animation | ✅ |
| GPS-Standort | ✅ |
| Sonne/Schatten-Info per Klick | ✅ |
| Nächster Wechsel anzeigen | ✅ |
| Ortssuche (GeoAdmin API) | ✅ |
| Datumsauswahl | ✅ |
| Wetter-Bewölkung (Open-Meteo) | ✅ |
| Favoriten speichern | ✅ |
| Kein Login, kein Tracking | ✅ |
| PWA-fähig | ✅ |

---

## 🚀 Lokale Entwicklung

**Kein npm, kein Build-System nötig** – nur ein Browser.

### Option A – direkt öffnen

```bash
# Repository klonen
git clone https://github.com/grejonbil/Sonnenfleck.git
cd Sonnenfleck

# index.html direkt im Browser öffnen:
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

> **Hinweis:** Manche APIs (Swisstopo WFS, Geolocation) funktionieren nur über HTTPS oder `localhost`. Nutze Option B für vollständige Funktionalität.

### Option B – lokaler Dev-Server

```bash
# Python (vorinstalliert auf macOS/Linux)
python3 -m http.server 8080
# → http://localhost:8080

# Oder Node.js
npx serve .
# → http://localhost:3000
```

Danach die App unter `http://localhost:8080` im Browser öffnen.

---

## 🗺️ APIs & Datenquellen

| Komponente | Quelle | Kosten |
|---|---|---|
| Karte & Kartenstil | [Swisstopo Vector Tiles](https://www.swisstopo.admin.ch/) | Kostenlos |
| Gebäudedaten (primär) | [Swisstopo WFS API](https://www.geo.admin.ch/) | Kostenlos |
| Gebäudedaten (Fallback) | [OpenStreetMap / Overpass API](https://overpass-api.de/) | Kostenlos |
| Sonnenberechnung | [SunCalc.js](https://github.com/mourner/suncalc) | Open Source |
| Wetter | [Open-Meteo](https://open-meteo.com/) | Kostenlos |
| Ortssuche | [Swisstopo GeoAdmin](https://api3.geo.admin.ch/) | Kostenlos |
| Hosting | [GitHub Pages](https://pages.github.com/) | Kostenlos |

**Betriebskosten: CHF 0 / Monat**

---

## 🏗️ Projektstruktur

```
Sonnenfleck/
├── index.html      ← Einstiegspunkt & HTML-Struktur
├── style.css       ← Mobile-first Styles
├── app.js          ← Hauptlogik & Kartensteuerung
├── sun.js          ← Sonnenberechnung (SunCalc-Wrapper)
├── shadow.js       ← Schattenberechnung & MapLibre-Layer
├── weather.js      ← Open-Meteo API-Integration
├── favorites.js    ← LocalStorage-Favoritenverwaltung
├── manifest.json   ← PWA Web App Manifest
├── LICENSE         ← MIT
└── README.md
```

---

## 🔬 Wie die Schattenberechnung funktioniert

1. **SunCalc.js** berechnet Azimut und Elevationswinkel der Sonne für Koordinaten + Zeit
2. **Swisstopo WFS** (oder Overpass-Fallback) liefert Gebäudeumrisse mit Höhenangaben
3. Für jedes Gebäude wird der Schattenpolygon berechnet:  
   `Schattenlänge = Gebäudehöhe / tan(Elevationswinkel)`
4. Der Schatten-Polygon ist die konvexe Hülle aus Original-Fussabdruck + projiziertem Fussabdruck
5. **MapLibre GL JS** rendert die Polygone als semitransparenten Layer auf der Karte

---

## 📱 Browser-Unterstützung

- ✅ iOS Safari 16+
- ✅ Android Chrome 110+
- ✅ Chrome / Edge / Firefox (Desktop)
- ⚠️ Internet Explorer: nicht unterstützt

---

## 📄 Lizenz

MIT – siehe [LICENSE](LICENSE)

---

*SonnenCheck Schweiz – Anforderungsdokument v1.0 · April 2026*
