import { FLAG_INFO, type Flag } from '../data/exercises'

export default function FlagBadges({ flags, active }: { flags: Flag[]; active: Flag[] }) {
  const hit = flags.filter((f) => active.includes(f))
  if (!hit.length) return null
  return (
    <span className="flags">
      {hit.map((f) => <span key={f} className="flag" title={FLAG_INFO[f].label}>⚠ {FLAG_INFO[f].short}</span>)}
    </span>
  )
}
