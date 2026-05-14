/* global React */

// ————————— Splash screen —————————
function Splash({ exiting, onEnter }) {
  return (
    <div className={"splash" + (exiting ? " out" : "")}>
      <div className="splash-mark">
        <span className="glyph" />
        <span>Sonnenfleck</span>
      </div>

      <div className="splash-hero">
        <h1 className="splash-title">
          Folge dem<br/><em>Sonnenfleck.</em>
        </h1>
        <p className="splash-tagline">
          Sieh in Echtzeit, wo in der Schweiz gerade die Sonne scheint — und wie lange noch.
        </p>
      </div>

      <div className="splash-footer">
        <button className="splash-cta" onClick={onEnter}>
          <span>Karte öffnen</span>
          <span className="arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M 3 7 L 11 7 M 7 3 L 11 7 L 7 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
        <div className="splash-meta">
          Daten · swisstopo<br/>Wetter · MeteoSchweiz
        </div>
      </div>
    </div>
  );
}
window.Splash = Splash;

// ————————— Status pill —————————
function StatusPill({ inSun, place }) {
  return (
    <div className={"status-pill" + (inSun ? "" : " shade")}>
      <span className="icon" />
      <span>
        {inSun ? "In der Sonne" : "Im Schatten"} · noch {inSun ? "47 Min" : "12 Min"}
      </span>
    </div>
  );
}
window.StatusPill = StatusPill;

// ————————— Map popup —————————
function MapPopup({ marker, onClose }) {
  if (!marker) return null;
  const flipBelow = marker.y < 32;
  return (
    <div
      className={"map-popup" + (flipBelow ? " below" : "")}
      style={{ left: marker.x + "%", top: marker.y + "%" }}
      role="dialog"
    >
      <div className="pop-row">
        <div className={"pop-icon" + (marker.sun ? "" : " shade")}>
          {marker.sun ? (
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="4" fill="#4A2A0A"/><g stroke="#4A2A0A" strokeWidth="1.5" strokeLinecap="round">{[0,45,90,135,180,225,270,315].map(d=><line key={d} x1="10" y1="2.5" x2="10" y2="4.5" transform={`rotate(${d} 10 10)`}/>)}</g></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M 13 4 A 6 6 0 1 0 13 16 A 5 5 0 1 1 13 4 Z" fill="#1F2A40"/></svg>
          )}
        </div>
        <div className="pop-body">
          <div className="pop-place">{marker.place || "Bellevue"}</div>
          <div className="pop-meta-inline">
            {marker.sun
              ? <>Noch <strong>{marker.minutes} Min</strong> · bis {marker.until}</>
              : <>Sonne ab <strong>{marker.until}</strong></>}
          </div>
        </div>
      </div>
    </div>
  );
}
window.MapPopup = MapPopup;

// ————————— Impressum sheet —————————
function Impressum({ onClose }) {
  return (
    <>
      <div className="modal-scrim" onClick={onClose} />
      <div className="impressum" role="dialog">
        <div className="sheet-grab" />
        <h2>Über SonnenFleck</h2>
        <p>
          Ein Wochenend-Projekt aus Zürich. SonnenFleck zeigt dir auf der Karte,
          wo in den nächsten Minuten die Sonne scheint — basierend auf echten
          Gebäudedaten und astronomischer Sonnenberechnung.
        </p>
        <p style={{fontWeight:700, color:"var(--ink)", marginTop:18}}>Datenquellen</p>
        <div className="src-grid">
          <div className="src">
            <div className="badge">3D</div>
            <div>
              <div className="label">swissBUILDINGS3D 3.0</div>
              <div className="desc">Bundesamt für Landestopografie · swisstopo</div>
            </div>
          </div>
          <div className="src">
            <div className="badge">☼</div>
            <div>
              <div className="label">SunCalc Algorithmen</div>
              <div className="desc">Astronomische Sonnenposition · Mourner</div>
            </div>
          </div>
          <div className="src">
            <div className="badge">⛅</div>
            <div>
              <div className="label">MeteoSchweiz Wetter-API</div>
              <div className="desc">Live-Temperatur und Bewölkung</div>
            </div>
          </div>
          <div className="src">
            <div className="badge">🗺</div>
            <div>
              <div className="label">Kartenstil swisstopo Light</div>
              <div className="desc">Vektorkacheln · CC BY 4.0</div>
            </div>
          </div>
        </div>
        <p style={{marginTop:18, fontSize:12}}>
          © 2026 SonnenFleck · Kontakt: hallo@sonnenfleck.ch
        </p>
        <button
          onClick={onClose}
          style={{
            width:"100%", marginTop:16, padding:14,
            background:"var(--ink)", color:"var(--cream-50)",
            borderRadius:"var(--r-md)", fontWeight:700,
            fontFamily:"var(--font-display)"
          }}
        >Schliessen</button>
      </div>
    </>
  );
}
window.Impressum = Impressum;
