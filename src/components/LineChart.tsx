// Basit çizgi grafik: eşit ölçekli eksen, son nokta vurgulu, isteğe bağlı kesikli projeksiyon.
export interface Pt { t: number; v: number }

export default function LineChart({ points, projection, unit = '', height = 150, color = 'var(--accent)' }: {
  points: Pt[]; projection?: Pt[]; unit?: string; height?: number; color?: string
}) {
  if (points.length < 2) return <p className="muted small">Grafik için en az 2 kayıt gerekiyor.</p>
  const W = 320, H = height, L = 34, Rr = 10, T = 10, B = 22
  const all = [...points, ...(projection ?? [])]
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
