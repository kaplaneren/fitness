// Basit çizgi grafik: eşit ölçekli eksen, son nokta vurgulu, isteğe bağlı kesikli projeksiyon.
export interface Pt { t: number; v: number }

export default function LineChart({ points, projection, unit = '', height = 150, color = 'var(--accent)', target, targetLabel, raw }: {
  points: Pt[]; projection?: Pt[]; unit?: string; height?: number; color?: string; target?: number; targetLabel?: string; raw?: Pt[]
}) {
  if (points.length < 2) return <p className="muted small">Grafik için en az 2 kayıt gerekiyor.</p>
  const W = 320, H = height, L = 34, Rr = 10, T = 10, B = 22
  const all = [...points, ...(projection ?? []), ...(raw ?? []), ...(target != null ? [{ t: points[0].t, v: target }] : [])]
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t))
  let v0 = Math.min(...all.map((p) => p.v)), v1 = Math.max(...all.map((p) => p.v))
  const pad = (v1 - v0) * 0.15 || 1
  v0 = Math.floor(v0 - pad); v1 = Math.ceil(v1 + pad)
  const x = (t: number) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - Rr)
  const y = (v: number) => T + (1 - (v - v0) / (v1 - v0 || 1)) * (H - T - B)
  const ticks = [v0, (v0 + v1) / 2, v1]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const area = `${path} L${x(points[points.length - 1].t).toFixed(1)} ${H - B} L${x(points[0].t).toFixed(1)} ${H - B} Z`
  const last = points[points.length - 1]
  const fmtD = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end">{Math.round(v * 10) / 10}</text>
          </g>
        ))}
        <text x={L} y={H - 6}>{fmtD(t0)}</text>
        <text x={W - Rr} y={H - 6} textAnchor="end">{fmtD(t1)}</text>
        {target != null && (
          <g>
            <line x1={L} x2={W - Rr} y1={y(target)} y2={y(target)} stroke="var(--good)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={L + 4} y={y(target) - 4} style={{ fill: 'var(--good)' }}>{targetLabel ?? 'hedef'} {Math.round(target * 10) / 10}</text>
          </g>
        )}
        {raw?.map((p, i) => <circle key={'r' + i} cx={x(p.t)} cy={y(p.v)} r="2" fill="var(--ink-2)" opacity="0.45" />)}
        <path d={area} fill={color} opacity="0.12" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {projection && projection.length > 1 && (
          <path d={projection.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 4" opacity="0.7" />
        )}
        {points.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === points.length - 1 ? 4 : 2.2} fill={i === points.length - 1 ? color : 'var(--surface)'} stroke={color} strokeWidth="1.5" />)}
        <text x={Math.min(x(last.t), W - Rr - 2)} y={y(last.v) - 8} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 800 }}>{Math.round(last.v * 10) / 10}{unit}</text>
      </svg>
    </div>
  )
}

export function Bars({ values, labels, color = 'var(--accent)', height = 110 }: { values: number[]; labels: string[]; color?: string; height?: number }) {
  const W = 320, H = height, B = 18, max = Math.max(1, ...values)
  const bw = (W / values.length) * 0.62, gap = W / values.length
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <line x1="0" x2={W} y1={H - B} y2={H - B} stroke="var(--line)" />
        {values.map((v, i) => {
          const h = (v / max) * (H - B - 14)
          return (
            <g key={i}>
              <rect x={i * gap + (gap - bw) / 2} y={H - B - h} width={bw} height={Math.max(h, v ? 2 : 0)} rx="4" fill={color} opacity={i === values.length - 1 ? 1 : 0.55} />
              {v > 0 && <text x={i * gap + gap / 2} y={H - B - h - 4} textAnchor="middle">{v}</text>}
              <text x={i * gap + gap / 2} y={H - 4} textAnchor="middle">{labels[i]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function MultiLine({ series, labels, height = 160 }: { series: { name: string; color: string; values: number[] }[]; labels: string[]; height?: number }) {
  const W = 320, H = height, L = 26, Rr = 8, T = 10, B = 20
  const max = Math.max(4, ...series.flatMap((s) => s.values))
  const n = labels.length
  const x = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - Rr)
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {[0, max / 2, max].map((v, i) => (
          <g key={i}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 5} y={y(v) + 3} textAnchor="end">{Math.round(v)}</text></g>
        ))}
        {labels.map((l, i) => (i % 2 === n % 2 || i === n - 1 ? <text key={i} x={x(i)} y={H - 5} textAnchor="middle">{l}</text> : null))}
        {series.map((s) => (
          <g key={s.name}>
            <path d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r="3" fill={s.color} />
          </g>
        ))}
      </svg>
      <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  )
}

export function CalendarHeat({ grid, max = 20 }: { grid: { key: string; t: number; sets: number }[][]; max?: number }) {
  const c = 14, g = 3, top = 14, left = 18
  const W = left + grid.length * (c + g), H = top + 7 * (c + g)
  const today = Date.now()
  return (
    <div className="chart" style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Antrenman takvimi" style={{ minWidth: 280 }}>
        {['Pt', 'Ça', 'Pa'].map((d, i) => <text key={d} x={0} y={top + (i * 3) * (c + g) + 11}>{d}</text>)}
        {grid.map((col, wi) => (
          <g key={wi}>
            {(wi === 0 || new Date(col[0].t).getDate() <= 7) && <text x={left + wi * (c + g)} y={9}>{new Date(col[0].t).toLocaleDateString('tr-TR', { month: 'short' })}</text>}
            {col.map((d, di) => (
              <rect key={d.key} x={left + wi * (c + g)} y={top + di * (c + g)} width={c} height={c} rx="3"
                fill={d.t > today ? 'transparent' : d.sets ? `color-mix(in srgb, var(--accent) ${Math.round(35 + Math.min(1, d.sets / max) * 65)}%, var(--surface-2))` : 'var(--surface-2)'}
                stroke={d.t > today ? 'var(--line)' : 'none'}>
                <title>{new Date(d.t).toLocaleDateString('tr-TR')} · {d.sets} set</title>
              </rect>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
