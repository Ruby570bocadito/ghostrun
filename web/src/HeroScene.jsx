// The home screen's small story: ghosts run a level, most of them fall into the same gap,
// and the spot gets marked as a blocker. Pure SVG + CSS; still under prefers-reduced-motion.
const GHOSTS = [
  { color: '#ffd166', delay: 0, falls: true },
  { color: '#4cc9f0', delay: 0.5, falls: true },
  { color: '#80ed99', delay: 1.0, falls: false },
  { color: '#ff6b6b', delay: 1.5, falls: true },
];

function Ghost({ color }) {
  return (
    <g>
      <path d="M16 2C8.8 2 3 7.8 3 15v17l4.3-3 4.3 3 4.4-3 4.3 3 4.4-3L29 32V15C29 7.8 23.2 2 16 2z" fill={color} />
      <circle cx="11.5" cy="15" r="2.6" fill="#0b0d17" />
      <circle cx="20.5" cy="15" r="2.6" fill="#0b0d17" />
    </g>
  );
}

export function HeroScene() {
  return (
    <svg className="hero-scene" viewBox="0 0 640 170" role="img" aria-labelledby="hero-scene-title">
      <title id="hero-scene-title">Four ghosts run across a level; three fall into the same gap, which gets marked as a blocker.</title>
      {/* ground with a gap */}
      <rect x="0" y="128" width="300" height="42" fill="#2ec4b6" />
      <rect x="0" y="128" width="300" height="5" fill="#9bf6ec" />
      <rect x="392" y="128" width="248" height="42" fill="#2ec4b6" />
      <rect x="392" y="128" width="248" height="5" fill="#9bf6ec" />
      <rect x="300" y="160" width="92" height="10" fill="#3a1020" />
      <g transform="translate(590 70)">
        <rect x="0" y="0" width="3" height="58" fill="#dddddd" />
        <path d="M3 2 L30 12 L3 22 Z" fill="#f6d55c" />
      </g>
      {/* the blocker box appears after the falls */}
      <g className="hero-blocker">
        <rect x="282" y="40" width="128" height="128" rx="10" fill="rgba(255,107,107,0.12)" stroke="#ff6b6b" strokeWidth="2" strokeDasharray="6 5" />
        <rect x="294" y="28" width="104" height="24" rx="12" fill="#ff6b6b" />
        <text x="346" y="45" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="12" fill="#0b0d17">
          Blocker · 3/4
        </text>
      </g>
      {GHOSTS.map((g, i) => (
        <g key={i} className={`hero-ghost ${g.falls ? 'falls' : 'makes-it'}`} style={{ animationDelay: `${g.delay}s` }}>
          <g transform="scale(0.9)">
            <Ghost color={g.color} />
          </g>
        </g>
      ))}
      <g className="hero-crosses">
        {[322, 345, 368].map((x) => (
          <path key={x} d={`M${x - 6} 150 L${x + 6} 162 M${x + 6} 150 L${x - 6} 162`} stroke="#ff6b6b" strokeWidth="3" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}
