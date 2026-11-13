import { fmtNum } from '../lib/calc'
import { useState } from 'react'
import { db, type Workout } from '../db'
import { useProfile } from '../hooks'
import { ACTIVITIES, activityDef, activityKcal, activityMet, bmr, type Intensity } from '../lib/activity'
import { notify } from './Dialog'

const pad = (n: number) => String(n).padStart(2, '0')
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Salon dışı aktivite ekleme / düzenleme. */
export default function ActivitySheet({ w, onClose }: { w?: Workout; onClose: () => void }) {
  const profile = useProfile()
  const a0 = w?.activity
  const start0 = new Date(w?.startedAt ?? Date.now() - 60 * 60000)
  const [type, setType] = useState(a0?.type ?? 'walk')
  const [min, setMin] = useState(String(a0?.min ?? 60))
  const [intensity, setIntensity] = useState<Intensity>(a0?.intensity ?? 'orta')
  const [km, setKm] = useState(a0?.km ? String(a0.km) : '')
  const [hr, setHr] = useState(w?.heartRateAvg ? String(w.heartRateAvg) : '')
  const [date, setDate] = useState(dateStr(start0))
  const [time, setTime] = useState(timeStr(start0))
  const [note, setNote] = useState(w?.note ?? '')
  const def = activityDef(type)
  const minutes = Math.max(0, parseFloat(min) || 0)
  const info = { type, min: minutes, intensity, km: def.distance && parseFloat(km) > 0 ? parseFloat(km) : undefined }
  const kg = w?.bodyweight ?? profile.bodyweight
  const hrN = parseInt(hr) || undefined
  const startedAt = new Date(`${date}T${time || '12:00'}`).getTime()
  const draft: Workout = { name: def.name, startedAt, endedAt: startedAt + minutes * 60000, exercises: [], activity: info, bodyweight: kg, heartRateAvg: hrN, note: note.trim() || undefined }
  const kcal = activityKcal(info, profile, kg)
  const { met, from } = activityMet(info)

  const save = async () => {
    if (!minutes) { notify('Süreyi gir.'); return }
    if (!Number.isFinite(startedAt)) { notify('Tarih veya saat geçersiz.'); return }
    if (w?.id) await db.workouts.put({ ...draft, id: w.id })
    else await db.workouts.add(draft)
    onClose()
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Vazgeç</button>
        <strong>{w ? 'Aktiviteyi düzenle' : 'Aktivite ekle'}</strong>
        <button className="btn ghost" onClick={save}>Kaydet</button>
      </div>
      <div className="sheet-body">
        <div className="card">
          <h3>Ne yaptın?</h3>
          <div className="chips wrap">
            {ACTIVITIES.map((a) => <button key={a.id} className={`chip ${type === a.id ? 'on' : ''}`} onClick={() => setType(a.id)}>{a.name}</button>)}
          </div>
        </div>
        <div className="card">
          <div className="fields two">
            <label className="field">Tarih<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="field">Başlangıç<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
          <div className="fields two">
            <label className="field">Süre (dk)<input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></label>
            {def.distance && <label className="field">Mesafe (km)<input inputMode="decimal" step="0.1" placeholder="isteğe bağlı" value={km} onChange={(e) => setKm(e.target.value)} /></label>}
          </div>
          <h3>Yoğunluk</h3>
          <div className="seg">
            {(['hafif', 'orta', 'yogun'] as Intensity[]).map((v) => <button key={v} className={intensity === v ? 'on' : ''} onClick={() => setIntensity(v)}>{v === 'yogun' ? 'Yoğun' : v === 'orta' ? 'Orta' : 'Hafif'}</button>)}
          </div>
          <p className="muted tiny">{def.hint[intensity === 'hafif' ? 0 : intensity === 'orta' ? 1 : 2]}{info.km && ['run', 'walk', 'cycle'].includes(type) ? ' · mesafe girildiği için hızdan hesaplanır' : ''}</p>
          <div className="fields">
            <label className="field">Ort. nabız<input inputMode="numeric" placeholder="isteğe bağlı" value={hr} onChange={(e) => setHr(e.target.value)} /></label>
          </div>
          <textarea className="input" rows={2} placeholder="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="card">
          <div className="row-between"><h3>Tahmini yakılan</h3><b className="num-d">{hrN && hrN >= 80 ? '≈' : ''}{hrN && hrN >= 80 ? '' : kcal} kcal</b></div>
          <p className="muted tiny">
            {hrN && hrN >= 80
              ? 'Ortalama nabız girdiğin için kaydedince nabız, kilo, yaş ve cinsiyetten (Keytel formülü) hesaplanır.'
              : `MET ${fmtNum(met, 1)} (${from}) × ${kg} kg × ${minutes} dk, dinlenme metabolizman (${Math.round(bmr(profile, kg))} kcal/gün; yaş, boy, cinsiyet) düşüldü.`}
          </p>
          {type === 'walk' && <p className="muted tiny">Yürüyüşün adımların zaten günlük adım hedefine sayılıyorsa ayrıca eklersen aynı yürüyüşü iki kez saymış olursun.</p>}
        </div>
        <button className="btn primary block" onClick={save}>{w ? 'Kaydet' : 'Aktiviteyi ekle'}</button>
      </div>
    </div>
  )
}
