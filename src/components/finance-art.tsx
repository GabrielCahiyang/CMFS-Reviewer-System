export function FinanceArt() {
  return (
    <svg viewBox="0 0 390 220" fill="none" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient
          id="book-edge"
          x1="92"
          y1="121"
          x2="287"
          y2="201"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9A8DED" />
          <stop offset="1" stopColor="#6554C7" />
        </linearGradient>
        <linearGradient
          id="book-top"
          x1="112"
          y1="96"
          x2="288"
          y2="165"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#B7A8FF" />
          <stop offset="1" stopColor="#8B78E7" />
        </linearGradient>
        <linearGradient
          id="chart-bg"
          x1="181"
          y1="15"
          x2="311"
          y2="150"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="#F3F0FF" />
        </linearGradient>
        <filter id="art-shadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#5546A4" floodOpacity=".12" />
        </filter>
      </defs>
      <ellipse cx="218" cy="197" rx="115" ry="15" fill="#DCD6F4" opacity=".45" />
      <circle cx="245" cy="109" r="91" fill="#E5DFFC" opacity=".6" />
      <circle cx="245" cy="109" r="72" stroke="#D2C9EF" strokeDasharray="3 5" />
      <g filter="url(#art-shadow)">
        <path d="M104 154L234 109L313 149L185 198L104 169V154Z" fill="#D5CEF4" />
        <path d="M104 154L234 109L313 149L184 185L104 154Z" fill="#E7E2F8" />
        <path d="M111 153L185 181L306 148V158L185 192L111 165V153Z" fill="#FBFAFF" />
        <path d="M111 159L185 186L303 152" stroke="#DDD6EE" strokeWidth="1.5" />
        <path d="M102 128L231 88L310 124V143L183 186L102 150V128Z" fill="url(#book-edge)" />
        <path d="M102 128L231 88L310 124L182 167L102 128Z" fill="url(#book-top)" />
        <path d="M115 129L182 161L298 123" stroke="#D7CEFF" strokeWidth="1.5" />
        <path
          d="M182 168V181M193 167L219 158"
          stroke="#B2A4F1"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g
        className="finance-float"
        style={{ transformOrigin: '240px 100px' }}
        filter="url(#art-shadow)"
      >
        <rect
          x="167"
          y="23"
          width="137"
          height="112"
          rx="12"
          fill="url(#chart-bg)"
          transform="rotate(7 167 23)"
        />
        <rect
          x="180"
          y="38"
          width="38"
          height="5"
          rx="2.5"
          fill="#D1C8F3"
          transform="rotate(7 180 38)"
        />
        <rect
          x="179"
          y="50"
          width="23"
          height="3"
          rx="1.5"
          fill="#E0DAF3"
          transform="rotate(7 179 50)"
        />
        <path d="M178 110L277 123M180 89L279 102M183 68L282 81" stroke="#E8E3F6" />
        <path
          d="M184 113L186 98L200 100L217 82L233 91L252 68L272 75"
          stroke="#8B77DE"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M260 74L272 75L271 87"
          stroke="#8B77DE"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="233" cy="91" r="4" fill="#8B77DE" stroke="white" strokeWidth="2" />
      </g>
      <g filter="url(#art-shadow)">
        <rect
          x="111"
          y="66"
          width="67"
          height="48"
          rx="9"
          fill="white"
          transform="rotate(-12 111 66)"
        />
        <circle cx="133" cy="84" r="10" fill="#EAF7F1" />
        <path
          d="M129 84L132 87L138 80"
          stroke="#72AE95"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="149"
          y="74"
          width="16"
          height="4"
          rx="2"
          fill="#C6BDD9"
          transform="rotate(-12 149 74)"
        />
        <rect
          x="150"
          y="83"
          width="10"
          height="3"
          rx="1.5"
          fill="#E1DBEB"
          transform="rotate(-12 150 83)"
        />
      </g>
      <g filter="url(#art-shadow)">
        <ellipse cx="291" cy="164" rx="20" ry="8" fill="#C4B071" />
        <path d="M271 153V164C271 168 280 172 291 172C302 172 311 168 311 164V153" fill="#E1CC8B" />
        <ellipse cx="291" cy="153" rx="20" ry="8" fill="#F6E6B9" />
        <ellipse cx="291" cy="153" rx="14" ry="5" stroke="#DBC78D" />
        <path d="M271 144V154C271 158 280 162 291 162C302 162 311 158 311 154V144" fill="#E3D097" />
        <ellipse cx="291" cy="144" rx="20" ry="8" fill="#F8EAC4" />
        <ellipse cx="291" cy="144" rx="14" ry="5" stroke="#DBC78D" />
        <path
          d="M288 142L294 143M289 146L294 143L291 140"
          stroke="#C7AF73"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M99 103V111M95 107H103M325 82V90M321 86H329M146 28V34M143 31H149"
        stroke="#B8ACE8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="317" cy="119" r="3" fill="#C9BCEE" />
      <circle cx="125" cy="185" r="3" fill="#C9BCEE" />
      <circle cx="212" cy="16" r="2" fill="#C9BCEE" />
    </svg>
  )
}
