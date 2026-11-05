import { ask } from './Dialog'
import { mondayOf, setMeso, startMeso, useMeso } from '../lib/meso'

const OPTIONS = [{ v: 0, l: 'Kapalı' }, { v: 3, l: '3+1' }, { v: 4, l: '4+1' }, { v: 5, l: '5+1' }]

/** Döngü uzunluğu seçimi (Profil). Değiştirince döngü bu haftadan başlar. */
export function MesoSetting() {
  const { meso } = useMeso()
  const cur = meso?.load ?? 0
  return (
    <>
      <div className="seg">
        {OPTIONS.map((o) => (
          <button key={o.v} className={cur === o.v ? 'on' : ''} onClick={async () => {
            if (o.v === cur) return
            if (!o.v) { if (await ask('Döngü kapatılsın mı? Planlı deload haftası olmaz, deload önerisi yine çalışır.', { ok: 'Kapat' })) await setMeso(null); return }
            if (meso && !(await ask(`Döngü ${o.l} olarak bu haftadan yeniden başlasın mı?`, { ok: 'Başlat' }))) return
            await startMeso(o.v)
          }}>{o.l}</button>
        ))}
      </div>
      <p className="muted tiny">Örneğin 4+1: 4 hafta giderek zorlaşan yükleme, 1 hafta planlı deload. Döngü bitince kendiliğinden yeniden başlar.</p>
    </>
  )
}

/** Özet ve Antrenman ekranlarındaki döngü kartı. */
export default function MesoCard() {
  const { meso, state } = useMeso()
  if (!meso || !state) return null
  return (
    <div className={`card meso ${state.deload ? 'warn-card' : ''}`}>
      <div className="card-title">
        <h3>{state.title}</h3>
        <span className="pill">{state.deload ? 'Deload' : `RIR ${state.rir}`}</span>
      </div>
      <div className="meso-weeks" aria-label={`Döngü ${state.cycle}, hafta ${state.week}/${state.total}`}>
        {Array.from({ length: state.total }, (_, i) => (
          <span key={i} className={`${i + 1 < state.week ? 'past' : i + 1 === state.week ? 'now' : ''} ${i + 1 === state.total ? 'dl' : ''}`}>{i + 1 === state.total ? 'D' : i + 1}</span>
        ))}
      </div>
      <p className="small">{state.text}</p>
      <div className="row-between">
        <span className="muted tiny">{state.cycle}. döngü · bu hafta {state.daysLeft} gün kaldı</span>
        <button className="btn ghost sm" onClick={async () => {
          if (await ask('Döngü bu haftadan, 1. haftadan yeniden başlasın mı? Tatil veya ara sonrası kullan.', { ok: 'Yeniden başlat' })) await setMeso({ start: mondayOf(), load: meso.load })
        }}>Sıfırla</button>
      </div>
    </div>
  )
}
