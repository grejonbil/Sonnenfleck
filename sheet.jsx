/* global React */
const { useState, useMemo } = React;

// ————————— Sun-arc time slider (06:00 → 22:00) —————————
function SunArc({ hour, onChange, sunrise = 6.4, sunset = 20.7 }) {
  const min = 6, max = 22;
  const t = (hour - min) / (max - min);

  const W = 340, H = 56;
  const r  = 340;
  const cx = W / 2;
  const cy = r + 10;
  const halfChord = W / 2;
  const halfAngle = Math.asin(halfChord / r);
  const angAt = (tt) => -Math.PI / 2 - halfAngle + tt * 2 * halfAngle;
  const ptAt = (tt) => {
    const a = angAt(tt);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const sun = ptAt(t);
  const sx = sun.x, sy = sun.y;

  const srT = (sunrise - min) / (max - min);
  const ssT = (sunset  - min) / (max - min);
  const srP = ptAt(srT), ssP = ptAt(ssT);
  const srx = srP.x, sry = srP.y, ssx = ssP.x, ssy = ssP.y;

  const aboveHorizon = hour > sunrise && hour < sunset;

  const left  = ptAt(0);
  const right = ptAt(1);
  const arcPath    = `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${right.x} ${right.y}`;
  const filledPath = `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${sx} ${sy}`;

  const handleMove = (clientX, rect) => {
    const x = clientX - rect.left;
    const tt = Math.max(0, Math.min(1, x / rect.width));
    onChange(min + tt * (max - min));
  };

  return (
    <div className="sun-arc-wrap">
      <svg className="sun-arc" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.clientX, rect);
        }}
        onPointerMove={e => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.clientX, rect);
        }}
      >
        <defs>
          <linearGradient id="arcGrad" x1="0" x2="1">
            <stop offset="0%"  stopColor="#FFB16B" />
            <stop offset="50%" stopColor="#FFC230" />
            <stop offset="100%" stopColor="#F25B36" />
          </linearGradient>
          <radialGradient id="sunBead" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#FFF1B0" />
            <stop offset="60%" stopColor="#FFC230" />
            <stop offset="100%" stopColor="#E07A14" />
          </radialGradient>
          <filter id="sunBlur"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="rgba(45,26,14,.12)" strokeWidth="1" strokeDasharray="2 4" />
        <path d={arcPath} fill="none" stroke="rgba(45,26,14,.15)" strokeWidth="3" strokeLinecap="round" />
        <path d={filledPath} fill="none" stroke="url(#arcGrad)" strokeWidth="3.5" strokeLinecap="round" />

        <g>
          <circle cx={srx} cy={sry} r="3.2" fill="#FBF3E1" stroke="#C8A98B" strokeWidth="1.3" />
          <text x={srx + 8} y={sry - 4} fontFamily="DM Sans" fontSize="9" fontWeight="700" fill="#9D8262" letterSpacing=".05em">06:24</text>
          <circle cx={ssx} cy={ssy} r="3.2" fill="#FBF3E1" stroke="#C8A98B" strokeWidth="1.3" />
          <text x={ssx - 8} y={ssy - 4} textAnchor="end" fontFamily="DM Sans" fontSize="9" fontWeight="700" fill="#9D8262" letterSpacing=".05em">20:42</text>
        </g>

        {aboveHorizon && (
          <g style={{ transition: "transform .2s ease" }}>
            <circle cx={sx} cy={sy} r="14" fill="url(#sunBead)" opacity=".4" filter="url(#sunBlur)" />
            <circle cx={sx} cy={sy} r="9" fill="url(#sunBead)"
              style={{filter:"drop-shadow(0 0 8px rgba(255,200,80,.85))"}}/>
            <circle cx={sx} cy={sy} r="3.2" fill="#FFF6CC" />
          </g>
        )}
        {!aboveHorizon && (
          <g>
            <circle cx={sx} cy={sy} r="7" fill="#475977" />
            <circle cx={sx - 2} cy={sy - 2} r="6" fill="#FBF3E1" />
          </g>
        )}
      </svg>
      <div className="sun-arc-labels">
        <span>06</span><span>10</span><span>14</span><span>18</span><span>22</span>
      </div>
    </div>
  );
}

// ————————— Bottom Sheet —————————
function BottomSheet({
  place, hour, setHour,
  playing, setPlaying,
  speed, setSpeed,
  isFav, toggleFav,
  expanded, setExpanded,
  inSun,
}) {
  const [tab, setTab] = useState("favs");

  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  const fmt = (n) => String(n).padStart(2, "0");

  return (
    <div className={"sheet " + (expanded ? "tabs-open" : "collapsed")}>
      <div
        className="sheet-grab"
        onClick={() => setExpanded(!expanded)}
      />

      <div className="sheet-hero">
        <div className="sheet-place">
          <div className="place-row">
            <span className="pin" />
            <span>Aktuelle Position · 47.37°N</span>
          </div>
          <div className="place-name">{place}</div>
        </div>
        <div className="weather-chip">
          <span className="wicon" />
          <span>23°</span>
        </div>
      </div>

      <div className="sheet-time" aria-live="polite">
        <span className="digits">{fmt(hh)}</span>
        <span className="colon" aria-hidden="true">
          <span /><span />
        </span>
        <span className="digits">{fmt(mm)}</span>
      </div>

      <div className="suntimes">
        <div className="st">
          <span className="glyph" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="9" r="3" fill="currentColor"/>
              <line x1="0" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M 7 5 L 7 3 M 4 6 L 3 5 M 10 6 L 11 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
          </span>
          <span>06:24</span>
        </div>
        <span className="sep" />
        <div className="st"><span>noch 4h 0m Sonne</span></div>
        <span className="sep" />
        <div className="st">
          <span className="glyph" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="9" r="3" fill="currentColor" opacity=".5"/>
              <line x1="0" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M 7 9 L 7 11 M 4 9 L 3 10 M 10 9 L 11 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            </svg>
          </span>
          <span>20:42</span>
        </div>
      </div>

      <SunArc hour={hour} onChange={setHour} />

      <div className="playbar">
        <div className="date">
          <span className="cal" />
          <span>Heute · So 10. Mai</span>
        </div>
        <button
          className="play"
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M 3 2 L 12 7 L 3 12 Z" fill="currentColor"/></svg>
          )}
        </button>
        <div className="speed" role="tablist">
          {[1,2,4,8].map(s => (
            <button key={s} className={s === speed ? "active" : ""} onClick={() => setSpeed(s)}>{s}×</button>
          ))}
        </div>
      </div>

      <button className="now-btn" onClick={() => { setHour(16.7); setPlaying(false); }}>
        <span className="dot" /> Sprung zu jetzt · 16:42
      </button>

      <div className="sheet-tabs">
        <button className={tab==="favs"    ? "active" : ""} onClick={() => { setTab("favs");    setExpanded(true); }}>★ Favoriten</button>
        <button className={tab==="weather" ? "active" : ""} onClick={() => { setTab("weather"); setExpanded(true); }}>⛅ Wetter heute</button>
      </div>

      {tab === "favs" ? (
        <div className="fav-list">
          <button className="fav-chip">
            <span className="star">★</span> Bellevue
          </button>
          <button className="fav-chip">
            <span className="star">★</span> Üetliberg
          </button>
          <button className="fav-chip">
            <span className="star">★</span> Werdinsel
          </button>
          <button className="fav-chip">
            <span className="star">★</span> Bürkliplatz
          </button>
          <button className="fav-chip add">+ Hinzufügen</button>
        </div>
      ) : (
        <div className="weather-detail">
          <div>
            <div className="wk">Temperatur</div>
            <div className="wv">23°C</div>
          </div>
          <div>
            <div className="wk">Gefühlt</div>
            <div className="wv">25°C</div>
          </div>
          <div>
            <div className="wk">UV-Index</div>
            <div className="wv">6 · Hoch</div>
          </div>
          <div>
            <div className="wk">Wolken</div>
            <div className="wv">12%</div>
          </div>
        </div>
      )}
    </div>
  );
}

window.BottomSheet = BottomSheet;
