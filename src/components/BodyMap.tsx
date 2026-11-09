import type { Muscle } from '../data/exercises'

// Ön ve arka vücut şeması. Sol yarı çizilir, sağ yarı aynalanır (viewBox 200×400, merkez x=100).
const SIL_HALF =
  'M100 58 L92 58 C91 62 90 65 88 67 C76 69 62 69 54 74 C45 80 43 92 44 106 ' +
  'C42 122 40 138 41 150 C36 170 31 192 30 212 C28 224 30 236 34 244 C38 248 44 246 45 240 ' +
  'C45 230 45 220 47 212 C52 192 56 174 59 156 C62 142 64 130 65 120 ' +
  'C65 150 67 180 68 206 C64 240 62 272 66 302 C62 330 63 352 66 374 L62 390 L86 392 L85 372 ' +
  'C87 350 87 328 85 306 C90 280 94 250 96 224 L100 224 Z'

type Part = { m: Muscle; d: string }

const FRONT: Part[] = [
  { m: 'trapez', d: 'M92 64 C88 68 82 70 76 71 L96 74 Z' },
  { m: 'on_omuz', d: 'M74 72 C64 71 56 74 52 80 C50 86 52 92 56 96 C60 88 66 82 74 78 Z' },
  { m: 'yan_omuz', d: 'M52 80 C46 86 45 96 46 106 C49 108 52 104 55 98 C52 92 50 86 52 80 Z' },
  { m: 'gogus', d: 'M97 78 L97 118 C88 124 76 124 66 118 C60 113 57 104 58 96 C62 86 72 79 84 77 Z' },
  { m: 'biceps', d: 'M54 104 C48 114 46 130 47 144 C51 149 57 147 59 140 C61 128 60 114 57 104 Z' },
  { m: 'onkol', d: 'M45 152 C40 168 35 188 34 208 L43 211 C47 192 53 172 56 154 C53 150 48 149 45 152 Z' },
  { m: 'karin', d: 'M87 127 h10 v20 h-10 Z M87 150 h10 v20 h-10 Z M87 173 h10 v20 h-10 Z M87 196 h10 v18 c-4 2 -8 0 -10 -4 Z' },
  { m: 'oblik', d: 'M84 126 L66 121 C63 140 64 168 69 196 L84 206 Z' },
  { m: 'on_bacak', d: 'M73 220 C65 242 63 270 68 296 C74 304 86 304 91 296 C95 270 94 244 89 224 Z' },
  { m: 'ic_bacak', d: 'M91 224 C97 232 98 252 97 270 C94 264 92 250 90 234 Z' },
  { m: 'baldir', d: 'M69 314 C65 332 66 352 70 368 L78 368 C80 350 80 330 78 314 Z' }
]

const BACK: Part[] = [
  { m: 'trapez', d: 'M97 60 L90 62 C86 68 78 72 70 74 C82 80 92 96 97 118 Z' },
  { m: 'arka_omuz', d: 'M70 74 C60 72 52 76 48 84 C47 90 48 94 50 96 C56 90 62 84 70 80 Z' },
  { m: 'yan_omuz', d: 'M48 86 C44 92 44 100 46 106 C49 106 51 102 52 96 Z' },
  { m: 'sirt_ust', d: 'M72 82 C82 88 90 98 95 118 L82 116 C76 108 72 98 70 88 Z' },
  { m: 'kanat', d: 'M68 96 C74 110 84 120 96 124 L96 156 C88 166 78 174 71 178 C65 150 63 120 68 96 Z' },
  { m: 'bel', d: 'M90 160 L97 158 L97 208 L85 208 C85 190 86 174 90 160 Z' },
  { m: 'triceps', d: 'M53 102 C47 114 45 130 46 146 C51 150 57 148 60 140 C61 126 59 112 56 102 Z' },
  { m: 'onkol', d: 'M45 152 C40 168 35 188 34 208 L43 211 C47 192 53 172 56 154 C53 150 48 149 45 152 Z' },
  { m: 'kalca', d: 'M97 210 L97 250 C86 256 72 252 68 238 C66 224 72 212 84 208 Z' },
  { m: 'arka_bacak', d: 'M70 256 C66 272 67 290 71 304 L93 304 C96 286 96 268 94 256 C86 260 78 260 70 256 Z' },
  { m: 'baldir', d: 'M70 312 C62 326 62 346 70 360 C76 352 81 338 81 316 Z M84 314 C93 326 93 346 86 360 C82 350 81 332 84 314 Z' }
]

export type MuscleLevels = Partial<Record<Muscle, number>>

export default function BodyMap({ primary = [], secondary = [], levels, onPick, selected }: {
  primary?: Muscle[]; secondary?: Muscle[]; levels?: MuscleLevels; onPick?: (m: Muscle) => void; selected?: Muscle | null
}) {
  const fill = (m: Muscle) => {
    if (levels) {
      const v = levels[m] ?? 0
      if (v <= 0) return 'var(--muscle)'
      return `color-mix(in srgb, var(--accent) ${Math.round(25 + Math.min(1, v) * 75)}%, var(--muscle))`
    }
    if (selected === m || primary.includes(m)) return 'var(--accent)'
    if (secondary.includes(m)) return 'color-mix(in srgb, var(--accent) 40%, var(--muscle))'
    return 'var(--muscle)'
  }
  const side = (parts: Part[]) => parts.map((p, i) => (
    <path key={i} d={p.d} fill={fill(p.m)} stroke="var(--body)" strokeWidth="1.2" strokeLinejoin="round"
      onClick={onPick ? () => onPick(p.m) : undefined} style={onPick ? { cursor: 'pointer' } : undefined} />
  ))
  const figure = (parts: Part[], label: string) => (
    <figure>
      <svg viewBox="20 0 160 400" role="img" aria-label={`${label} vücut kas haritası`}>
        <ellipse cx="100" cy="32" rx="17" ry="21" fill="var(--body)" />
        <path d={SIL_HALF} fill="var(--body)" />
        <path d={SIL_HALF} fill="var(--body)" transform="translate(200 0) scale(-1 1)" />
        <g>{side(parts)}</g>
        <g transform="translate(200 0) scale(-1 1)">{side(parts)}</g>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
  return <div className="bodymap">{figure(FRONT, 'Ön')}{figure(BACK, 'Arka')}</div>
}
