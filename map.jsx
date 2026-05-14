/* global React */

// Stylized map — portrait, zoomed-in "Zürich · Bellevue" district view.
// Lake Zürich at the bottom, streets fanning out from the lakefront,
// city blocks, parks, river Limmat. Designed to fill a 402×874 device frame.
function SwissMap() {
  const blocks = [];
  const seed = (n) => { let s = n; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; } };
  const rand = seed(7);
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 20 + col * 50 + (rand() - .5) * 14;
      const y = 30 + row * 55 + (rand() - .5) * 12;
      const w = 30 + rand() * 18;
      const h = 24 + rand() * 18;
      if (y > 620 && x < 320) continue;
      if (y > 700) continue;
      const inPark = (x > 90 && x < 200 && y > 260 && y < 360);
      if (inPark) continue;
      blocks.push({ x, y, w, h, rot: (rand() - .5) * 8 });
    }
  }

  return (
    <svg
      viewBox="0 0 400 874"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="paperBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#FFFBF1" />
          <stop offset="60%" stopColor="#FBF3E1" />
          <stop offset="100%" stopColor="#F4E5C5" />
        </linearGradient>
        <linearGradient id="lakeBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#A8D2DC" />
          <stop offset="100%" stopColor="#6FA8B4" />
        </linearGradient>
        <linearGradient id="riverGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#A8D2DC" />
          <stop offset="100%" stopColor="#7CB0BB" />
        </linearGradient>
        <radialGradient id="parkBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#C9D8AC" />
          <stop offset="100%" stopColor="#A8BF85" />
        </radialGradient>
      </defs>

      {/* paper base */}
      <rect width="400" height="874" fill="url(#paperBg)" />

      {/* contour rings */}
      <g stroke="#C8A98B" strokeWidth=".7" fill="none" opacity=".22">
        {[0,1,2,3,4,5].map(i => (
          <path key={i} d={`M -20 ${100 + i*18} Q 180 ${80 + i*22} 420 ${110 + i*18}`} />
        ))}
        {[0,1,2,3,4].map(i => (
          <path key={"b"+i} d={`M -20 ${720 + i*22} Q 200 ${740 + i*16} 420 ${730 + i*22}`} />
        ))}
      </g>

      {/* River Limmat */}
      <path
        d="M 240 0 Q 235 80, 250 160 Q 270 230, 260 320 Q 250 410, 280 490 Q 305 560, 320 620"
        stroke="url(#riverGrad)"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
        opacity=".88"
      />
      <path
        d="M 240 0 Q 235 80, 250 160 Q 270 230, 260 320 Q 250 410, 280 490 Q 305 560, 320 620"
        stroke="#7CB0BB"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity=".55"
      />

      {/* Park (Bürkliplatz / Arboretum) */}
      <path
        d="M 90 270 Q 105 250, 145 256 Q 195 252, 200 290 Q 210 340, 175 360 Q 130 370, 100 355 Q 78 332, 90 270 Z"
        fill="url(#parkBg)" opacity=".75"
      />
      <g fill="#7C9657" opacity=".65">
        {Array.from({length: 22}).map((_,i) => {
          const a = (i / 22) * Math.PI * 2;
          const cx = 145 + Math.cos(a) * (35 + (i%3)*8);
          const cy = 310 + Math.sin(a) * (22 + (i%3)*6);
          return <circle key={i} cx={cx} cy={cy} r={2 + (i%3)*.6} />;
        })}
      </g>

      {/* City blocks */}
      <g>
        {blocks.map((b, i) => (
          <rect
            key={i}
            x={b.x} y={b.y} width={b.w} height={b.h}
            transform={`rotate(${b.rot} ${b.x + b.w/2} ${b.y + b.h/2})`}
            fill="#F2E2BE"
            stroke="#C8A98B"
            strokeWidth=".7"
            rx="1.5"
            opacity=".75"
          />
        ))}
      </g>

      {/* Streets — main avenues */}
      <g stroke="#FFFBF1" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M -20 540 Q 120 545, 250 535 Q 340 530, 420 525" />
        <path d="M -20 420 Q 120 425, 250 415 Q 340 410, 420 405" />
        <path d="M -20 280 Q 120 285, 240 270 Q 340 260, 420 255" />
        <path d="M -20 150 Q 120 155, 240 140 Q 340 130, 420 125" />
        <path d="M 80 -20 Q 88 200, 95 420 Q 100 600, 105 800" />
        <path d="M 180 -20 Q 175 200, 185 420 Q 190 600, 195 800" />
        <path d="M 340 -20 Q 335 200, 345 420 Q 350 600, 355 800" />
      </g>
      <g stroke="#E8D5A8" strokeWidth="1" fill="none" strokeLinecap="round" opacity=".5">
        <path d="M -20 540 Q 120 545, 250 535 Q 340 530, 420 525" />
        <path d="M -20 420 Q 120 425, 250 415 Q 340 410, 420 405" />
        <path d="M -20 280 Q 120 285, 240 270 Q 340 260, 420 255" />
        <path d="M -20 150 Q 120 155, 240 140 Q 340 130, 420 125" />
        <path d="M 80 -20 Q 88 200, 95 420 Q 100 600, 105 800" />
        <path d="M 180 -20 Q 175 200, 185 420 Q 190 600, 195 800" />
        <path d="M 340 -20 Q 335 200, 345 420 Q 350 600, 355 800" />
      </g>

      {/* Lake Zürich */}
      <path
        d="M 0 600 Q 80 595, 160 605 Q 220 615, 280 625 Q 340 635, 400 650 L 400 874 L 0 874 Z"
        fill="url(#lakeBg)"
      />
      <g stroke="#FFFBF1" strokeWidth=".7" fill="none" opacity=".35">
        <path d="M 30 680 Q 70 676, 110 680" />
        <path d="M 180 690 Q 220 686, 260 690" />
        <path d="M 80 720 Q 130 716, 180 720" />
        <path d="M 240 730 Q 290 726, 340 730" />
        <path d="M 40 770 Q 100 765, 160 770" />
        <path d="M 200 790 Q 270 786, 340 790" />
        <path d="M 100 830 Q 170 826, 240 830" />
      </g>

      {/* District labels */}
      <g fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="9" letterSpacing=".18em" fill="#5C4528">
        <text x="60"  y="100" opacity=".7">OBERSTRASS</text>
        <text x="280" y="80"  opacity=".7">UNTERSTRASS</text>
        <text x="40"  y="430" opacity=".8">ENGE</text>
        <text x="300" y="450" opacity=".8">SEEFELD</text>
        <text x="120" y="560" opacity=".85" fontWeight="800" fill="#2A1A0E" letterSpacing=".22em">BELLEVUE</text>
      </g>

      {/* Lake label */}
      <g fontFamily="DM Sans, sans-serif" fontWeight="700" fontSize="10" fill="#1B3A48" opacity=".55" letterSpacing=".2em">
        <text x="180" y="780">ZÜRICHSEE</text>
      </g>

      {/* Compass */}
      <g transform="translate(360, 50)" fontFamily="DM Sans" fontSize="9" fill="#A88A66">
        <circle cx="0" cy="0" r="11" fill="rgba(255,251,243,.6)" stroke="#A88A66" strokeWidth=".8" />
        <path d="M 0 -8 L 2.5 0 L 0 8 L -2.5 0 Z" fill="#A88A66" />
        <text x="-3" y="-14" fontWeight="700">N</text>
      </g>
    </svg>
  );
}

window.SwissMap = SwissMap;
