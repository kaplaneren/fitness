import { FLAG_INFO, type Flag } from '../data/exercises'
import { notify } from './Dialog'

/** Kısıta takılan hareketin rozetleri; dokununca neden riskli olduğu, ipucu ve (verildiyse) güvenli alternatifler. */
export default function FlagBadges({ flags, active, alt }: { flags: Flag[]; active: Flag[]; alt?: string[] }) {
  const hit = flags.filter((f) => active.includes(f))
  if (!hit.length) return null
  const explain = (e: React.MouseEvent) => {
    e.stopPropagation()
    const lines = hit.map((f) => `• ${FLAG_INFO[f].label}\n  ${FLAG_INFO[f].tip}`)
    notify(`Bu hareket sağlık kısıtlarına takılıyor:\n\n${lines.join('\n\n')}${alt?.length ? `\n\nDaha güvenli alternatifler: ${alt.join(', ')}.` : ''}\n\nAntrenmanda ağırlık artışı bu harekette temkinli yapılır.`, 'Neden riskli?')
  }
  return (
    <span className="flags">
      {hit.map((f) => <button type="button" key={f} className="flag" title={FLAG_INFO[f].label} onClick={explain}>⚠ {FLAG_INFO[f].short}</button>)}
    </span>
  )
}
