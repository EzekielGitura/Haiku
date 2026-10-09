import { useEffect, useState } from "react";
import { CHERUB_RETREAT_MS } from "@/lib/poem-rules";

function CherubDrawing() {
  return (
    <svg viewBox="0 0 220 230" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g
        className="cherub-wing wing-left"
        fill="var(--wing)"
        stroke="var(--cherub-outline)"
        strokeWidth="1.4"
      >
        <path d="M99 108C64 107 14 76 20 38C31 51 45 53 54 64C44 43 37 22 45 12C56 38 90 57 103 81Z" />
        <path d="M93 91C70 72 62 58 57 43M86 100C61 88 44 72 32 58" />
      </g>
      <g
        className="cherub-wing wing-right"
        fill="var(--wing)"
        stroke="var(--cherub-outline)"
        strokeWidth="1.4"
      >
        <path d="M124 107C147 93 190 85 202 46C183 48 164 61 157 73C164 49 174 32 165 15C153 44 125 56 118 85Z" />
        <path d="M131 85C146 66 153 53 157 40M139 96C164 83 182 67 188 57" />
      </g>
      <g
        fill="var(--cherub-skin)"
        stroke="var(--cherub-outline)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M100 128C94 148 74 158 67 173C63 182 69 189 78 185L99 166L111 152M124 141C128 158 125 175 116 187C111 195 116 202 124 198C141 186 149 161 141 139" />
        <path d="M103 86C86 96 83 119 92 140C100 158 134 154 144 134C146 118 130 97 122 91Z" />
        <path d="M96 102C78 96 68 94 52 85C44 79 40 88 47 94C63 107 77 112 94 115M128 104C144 107 157 108 170 119C177 123 184 116 175 110C160 97 148 93 129 93" />
        <circle cx="111" cy="71" r="27" />
      </g>
      <path
        d="M85 67C74 59 80 48 88 48C82 34 103 30 107 37C116 23 132 35 128 43C145 39 146 59 137 65C141 47 126 61 121 48C115 59 102 47 98 55C96 62 89 58 85 67Z"
        fill="var(--cherub-hair)"
        stroke="var(--cherub-outline)"
        strokeWidth="1.4"
      />
      <path
        d="M95 72Q99 68 102 71M117 72Q121 69 124 72M108 84Q113 88 118 83"
        stroke="var(--cherub-outline)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <ellipse cx="96" cy="79" rx="5" ry="3" fill="var(--cherub-blush)" />
      <ellipse cx="126" cy="79" rx="5" ry="3" fill="var(--cherub-blush)" />
      <path
        d="M92 126C109 138 125 136 141 126L147 147C126 161 104 157 88 146Z"
        fill="var(--wing)"
        stroke="var(--cherub-outline)"
        strokeWidth="1.4"
      />
      <path
        d="M171 80Q213 126 169 172"
        stroke="var(--cherub-gold)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M171 80L169 172" stroke="var(--cherub-gold)" strokeWidth="1.2" />
      <path
        d="M139 122L206 121M141 118L148 122L140 127"
        stroke="var(--cherub-gold)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M205 122C197 113 205 108 210 114C215 108 222 113 214 120L210 126Z"
        fill="var(--cherub-blush)"
      />
    </svg>
  );
}

export function Cherubs() {
  const [background, setBackground] = useState(false);
  useEffect(() => {
    setBackground(false);
    const timer = setTimeout(() => setBackground(true), CHERUB_RETREAT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className={`cherubs ${background ? "cherubs-background" : "cherubs-foreground"}`}
      aria-hidden="true"
      data-cherub-state={background ? "background" : "foreground"}
    >
      {[0, 1, 2, 3].map((number) => (
        <div key={number} className={`cherub cherub-${number}`}>
          <div className="cherub-float">
            <CherubDrawing />
          </div>
        </div>
      ))}
    </div>
  );
}
