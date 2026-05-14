/* global React, ReactDOM, IOSDevice, Splash, StatusPill, MapPopup, Impressum, SwissMap, BottomSheet, TweaksPanel, useTweaks, TweakSection, TweakSlider, TweakToggle, TweakRadio, TweakSelect, TweakColor */
const { useState, useEffect, useMemo, useRef } = React;

const MARKERS = [
  { id: "m1", x: 50, y: 64, sun: true,  place: "Bellevue",            label: "16:42", minutes: 47, until: "17:29" },
  { id: "m2", x: 35, y: 50, sun: true,  place: "Enge",                label: "16:42", minutes: 28, until: "17:10" },
  { id: "m3", x: 72, y: 51, sun: true,  place: "Seefeld · Kreuzplatz",label: "16:42", minutes: 64, until: "17:46" },
  { id: "m4", x: 28, y: 33, sun: false, place: "Oberstrass",          label: "16:42", minutes: 0,  until: "17:55" },
  { id: "m5", x: 64, y: 35, sun: true,  place: "Unterstrass · ETH",   label: "16:42", minutes: 80, until: "18:02" },
  { id: "m6", x: 80, y: 22, sun: true,  place: "Zürichberg",          label: "16:42", minutes: 92, until: "18:14" },
  { id: "m7", x: 19, y: 60, sun: false, place: "Wollishofen",         label: "16:42", minutes: 0,  until: "17:30" },
  { id: "m8", x: 56, y: 41, sun: true,  place: "Hauptbahnhof",        label: "16:42", minutes: 22, until: "17:04" },
  { id: "m9", x: 86, y: 38, sun: false, place: "Hottingen",           label: "16:42", minutes: 0,  until: "17:08" },
  { id: "m10",x: 42, y: 56, sun: true,  place: "Paradeplatz",         label: "16:42", minutes: 38, until: "17:20" },
];

function todForHour(h) {
  if (h < 6.5)  return "night";
  if (h < 8)    return "dawn";
  if (h < 11.5) return "morning";
  if (h < 15)   return "noon";
  if (h < 18.5) return "golden";
  if (h < 21)   return "dusk";
  return "night";
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "screen": "main",
  "hour": 16.7,
  "place": "Zürich · Bellevue",
  "sheetExpanded": false,
  "todAuto": true,
  "todManual": "golden",
  "showHandTrail": false
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState(tweaks.screen);
  const [hour, setHour] = useState(tweaks.hour);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeMarker, setActiveMarker] = useState(null);
  const [showImpressum, setShowImpressum] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(tweaks.sheetExpanded);
  const [isFav, setIsFav] = useState(true);

  useEffect(() => { setScreen(tweaks.screen); }, [tweaks.screen]);
  useEffect(() => { setHour(tweaks.hour);     }, [tweaks.hour]);
  useEffect(() => { setSheetExpanded(tweaks.sheetExpanded); }, [tweaks.sheetExpanded]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setHour(h => {
        const next = h + 0.04 * speed;
        if (next >= 22) { setPlaying(false); return 22; }
        return next;
      });
    }, 80);
    return () => clearInterval(id);
  }, [playing, speed]);

  const tod = tweaks.todAuto ? todForHour(hour) : tweaks.todManual;
  useEffect(() => {
    document.documentElement.dataset.tod = tod;
  }, [tod]);

  const activeMarkerData = MARKERS.find(m => m.id === activeMarker);
  const inSun = activeMarkerData?.sun ?? true;

  return (
    <>
      <div className="app">
        <div className="map-stage">
          <SwissMap />
          <div className="sky-tint" />
          <div className="tod-warm" />

          {MARKERS.map(m => (
            <div
              key={m.id}
              className={"marker " + (m.id === activeMarker ? "active" : "")}
              style={{ left: m.x + "%", top: m.y + "%" }}
              onClick={() => setActiveMarker(m.id)}
            >
              <div className={m.sun ? "marker-sun" : "marker-shade"} />
            </div>
          ))}

          {activeMarkerData && <MapPopup marker={activeMarkerData} />}
        </div>

        <div className="topbar">
          <div className="search-card">
            <span className="search-logo" />
            <input className="search-input" placeholder="Ort, Berg, Beizli suchen…" />
          </div>
          <StatusPill inSun={inSun} />
        </div>

        <button className="impressum-fab" onClick={() => setShowImpressum(true)} aria-label="Impressum">i</button>

        <button
          className="gps-btn"
          aria-label="Meine Position"
          style={{ bottom: sheetExpanded ? "calc(78% + 18px)" : "236px" }}
        >
          <span className="crosshair" />
        </button>

        <BottomSheet
          place={tweaks.place}
          hour={hour}
          setHour={setHour}
          playing={playing}
          setPlaying={setPlaying}
          speed={speed}
          setSpeed={setSpeed}
          isFav={isFav}
          toggleFav={() => setIsFav(v => !v)}
          expanded={sheetExpanded}
          setExpanded={setSheetExpanded}
          inSun={inSun}
        />

        {screen === "splash" && (
          <Splash onEnter={() => { setScreen("main"); setTweak("screen", "main"); }} />
        )}

        {showImpressum && <Impressum onClose={() => setShowImpressum(false)} />}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Screen">
          <TweakRadio
            label="Showing"
            value={screen}
            onChange={v => { setScreen(v); setTweak("screen", v); }}
            options={[
              { value: "splash", label: "Splash" },
              { value: "main",   label: "Main" },
            ]}
          />
        </TweakSection>

        <TweakSection title="Time">
          <TweakSlider
            label={`Hour · ${Math.floor(hour)}:${String(Math.round((hour-Math.floor(hour))*60)).padStart(2,"0")}`}
            min={6} max={22} step={0.1}
            value={hour}
            onChange={v => { setHour(v); setTweak("hour", v); }}
          />
          <TweakToggle
            label="Auto time-of-day palette"
            value={tweaks.todAuto}
            onChange={v => setTweak("todAuto", v)}
          />
          {!tweaks.todAuto && (
            <TweakSelect
              label="Palette"
              value={tweaks.todManual}
              onChange={v => setTweak("todManual", v)}
              options={[
                { value: "dawn",    label: "Dawn (Sonnenaufgang)" },
                { value: "morning", label: "Morning" },
                { value: "noon",    label: "Noon (Mittag)" },
                { value: "golden",  label: "Golden Hour" },
                { value: "dusk",    label: "Dusk (Abendrot)" },
                { value: "night",   label: "Night" },
              ]}
            />
          )}
        </TweakSection>

        <TweakSection title="Layout">
          <TweakToggle
            label="Sheet expanded"
            value={sheetExpanded}
            onChange={v => { setSheetExpanded(v); setTweak("sheetExpanded", v); }}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function Root() {
  const fitRef = React.useRef(null);
  React.useEffect(() => {
    const fit = () => {
      const el = fitRef.current; if (!el) return;
      const s = Math.min(1, (window.innerHeight - 32) / 874, (window.innerWidth - 32) / 402);
      el.style.setProperty("--s", s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="stage">
      <div className="device-fit" ref={fitRef}>
        <IOSDevice width={402} height={874}>
          <App />
        </IOSDevice>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
