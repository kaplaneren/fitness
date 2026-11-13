import { ask, askText, notify } from '../components/Dialog'
import type { Exercise } from '../data/exercises'
import { importProgram, programCode, shareLink } from '../lib/share'
import { shareText } from './History'
import QrSheet from '../components/QrSheet'
import { fmtRest, fmtPlan } from '../lib/calc'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Routine } from '../db'
import { useActiveWorkout, useExercises } from '../hooks'
import { MOBILITY_ROUTINES, startWorkout } from '../lib/workout'
import RoutineEditor from './RoutineEditor'
import Wizard from './Wizard'
import MesoCard from '../components/MesoCard'
import ActivitySheet from '../components/ActivitySheet'
import ExerciseLibrary from './Exercises'
import VersionFooter from '../components/VersionFooter'
import { fmtDate } from '../lib/calc'

export default function StartScreen({ onStarted }: { onStarted: () => void }) {
  const routines = useLiveQuery(() => db.routines.orderBy('name').toArray(), []) ?? []
  const lastByRoutine = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const w of await db.workouts.toArray()) if (w.routineId) m.set(w.routineId, Math.max(m.get(w.routineId) ?? 0, w.startedAt))
    return m
  }, []) ?? new Map<number, number>()
  const { workout } = useActiveWorkout()
  const { map } = useExercises()
  const [editing, setEditing] = useState<Routine | null>(null)
  const [wizard, setWizard] = useState(false)
  const [activity, setActivity] = useState(false)
  const [library, setLibrary] = useState(false)

  const start = async (r?: Routine) => {
    if (workout && !await ask('Devam eden bir antrenman var. Onu silip yenisini başlatayım mı?', { danger: true, ok: 'Yenisini başlat' })) return
    await startWorkout(r)
    onStarted()
  }

  const folders = new Map<string, Routine[]>()
  for (const r of routines) {
    const f = r.folder || 'Rutinlerim'
    folders.set(f, [...(folders.get(f) ?? []), r])
  }
  const [viewing, setViewing] = useState<Routine | null>(null)
  const [folderMenu, setFolderMenu] = useState<string | null>(null)
  const [qr, setQr] = useState<{ text: string; title: string } | null>(null)
  const showQr = async (list: Routine[], title: string, folder?: string) => {
    const code = await programCode(list, folder)
    const link = shareLink(code)
    setQr({ text: link.startsWith('#') ? code : link, title })
  }
  const renameFolder = async (f: string) => {
    const name = (await askText('Klasörün yeni adı', { title: 'Adı değiştir', value: f }))?.trim()
    if (!name || name === f) return
    if (folders.has(name) && !await ask(`"${name}" adında bir klasör zaten var. Rutinler o klasörle birleştirilsin mi?`, { ok: 'Birleştir' })) return
    await db.routines.bulkPut(folders.get(f)!.map((r) => ({ ...r, folder: name === 'Rutinlerim' ? undefined : name })))
  }
  const shareRoutines = async (list: Routine[], title: string, folder?: string) => {
    const code = await programCode(list, folder)
    const link = shareLink(code)
    await shareText(`${programText(list, title, map)}\n\nFitness uygulamasına eklemek için: ${link.startsWith('#') ? `Antrenman > Program içe aktar ekranına bu kodu yapıştır:\n${code}` : link}`, title)
  }
  const importPasted = async () => {
    const t = await askText('Arkadaşının paylaştığı program linkini veya kodunu yapıştır.', { title: 'Program içe aktar', placeholder: 'https://… veya kod', ok: 'Devam' })
    if (!t?.trim()) return
    const n = await importProgram(t)
    if (n) notify(`${n} rutin eklendi.`)
  }
  const deleteFolder = async (f: string) => {
    if (!await ask(`"${f}" klasöründeki tüm rutinler silinsin mi?`, { danger: true, ok: 'Sil' })) return
    await db.routines.bulkDelete(folders.get(f)!.map((r) => r.id!))
  }

  return (
    <div className="screen">
      <div className="screen-head"><h1>Antrenman</h1></div>
      <div className="stack">
        <button className="btn primary block" onClick={() => start()}>Boş antrenman başlat</button>
        <div className="row">
          <button className="btn grow" onClick={() => setWizard(true)}>Program oluştur</button>
          <button className="btn grow" onClick={() => setLibrary(true)}>Hareketler</button>
        </div>
        <button className="btn block" onClick={() => setActivity(true)}>+ Spor / aktivite ekle <span className="muted small">(tenis, yüzme, koşu…)</span></button>
        <button className="link small" onClick={importPasted}>Paylaşılan programı içe aktar</button>
      </div>

      <MesoCard />

      <div className="row-between">
        <h2>Rutinler</h2>
        <button className="btn ghost" onClick={() => setEditing({ name: '', exercises: [], updatedAt: 0 })}>+ Yeni rutin</button>
      </div>

      {routines.length === 0 && (
        <div className="card empty">
          <h3>Henüz rutinin yok</h3>
          <p className="muted small">Kaç gün gidebildiğini, ne kadar düzenli olduğunu ve ne kadar vaktin olduğunu söyle, sağlık kısıtlarına uygun bir program hazırlayayım.</p>
          <button className="btn primary" onClick={() => setWizard(true)}>Program oluştur</button>
        </div>
      )}

      {!folders.has('Isınma ve mobilite') && (
        <div className="card">
          <h3>Isınma ve mobilite rutinleri</h3>
          <p className="muted small">Üst ve alt vücut ısınması ile omurga ve bel bakımı rutini (McGill curl-up, side plank, bird dog, asılma). Bel ve dize yük bindirmez.</p>
          <button className="btn sm" onClick={() => db.routines.bulkAdd(MOBILITY_ROUTINES.map((r) => ({ ...r, updatedAt: Date.now() })))}>Rutinleri ekle</button>
        </div>
      )}

      {[...folders].map(([folder, list]) => (
        <section key={folder} className="stack">
          <div className="row-between">
            <span className="section-label">{folder}</span>
            <button className="icon-btn" aria-label="Klasör seçenekleri" onClick={() => setFolderMenu(folderMenu === folder ? null : folder)}>⋯</button>
          </div>
          {folderMenu === folder && (
            <div className="menu">
              <button onClick={() => { setFolderMenu(null); renameFolder(folder) }}>Adını değiştir</button>
              <button onClick={() => { setFolderMenu(null); shareRoutines(list, folder, folder === 'Rutinlerim' ? undefined : folder) }}>Programı paylaş</button>
              <button onClick={() => { setFolderMenu(null); showQr(list, folder, folder === 'Rutinlerim' ? undefined : folder) }}>QR kod göster</button>
              {folder !== 'Rutinlerim' && <button className="danger" onClick={() => { setFolderMenu(null); deleteFolder(folder) }}>Klasörü sil</button>}
            </div>
          )}
          <div className="grid2">
            {list.map((r) => (
              <div key={r.id} className="card">
                <button className="stack" style={{ gap: 6, textAlign: 'left' }} onClick={() => setViewing(r)}>
                  <h3>{r.name}</h3>
                  <p className="muted small clamp">{r.exercises.map((e) => map.get(e.exerciseId)?.name ?? e.exerciseId).join(', ')}</p>
                  <p className="muted tiny">{r.exercises.length} hareket{lastByRoutine.get(r.id!) ? ` · son: ${fmtDate(lastByRoutine.get(r.id!)!)}` : ''}</p>
                </button>
                <button className="btn primary sm" onClick={() => start(r)}>Başlat</button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <VersionFooter />
      {viewing && (
        <RoutineView r={viewing} map={map} last={lastByRoutine.get(viewing.id!)} onClose={() => setViewing(null)}
          onStart={() => { const r = viewing; setViewing(null); start(r) }}
          onEdit={() => { const r = viewing; setViewing(null); setEditing(r) }}
          onShare={() => shareRoutines([viewing], viewing.name, viewing.folder)}
          onQr={() => showQr([viewing], viewing.name, viewing.folder)} />
      )}
      {qr && <QrSheet text={qr.text} title={qr.title} onClose={() => setQr(null)} />}
      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} />}
      {wizard && <Wizard onClose={() => setWizard(false)} />}
      {activity && <ActivitySheet onClose={() => setActivity(false)} />}
      {library && <ExerciseLibrary onClose={() => setLibrary(false)} />}
    </div>
  )
}

function programText(list: Routine[], title: string, map: Map<string, Exercise>) {
  const lines = [`📋 ${title}`]
  list.forEach((r, i) => {
    if (list.length > 1 || r.name !== title) lines.push('', r.name); else lines.push('')
    for (const e of r.exercises) lines.push(`• ${map.get(e.exerciseId)?.name ?? e.exerciseId}: ${fmtPlan(e.reps, e.sets)}${e.superset ? ` (süperset ${e.superset.toUpperCase()})` : ''}`)
  })
  return lines.join('\n')
}

function RoutineView({ r, map, last, onClose, onStart, onEdit, onShare, onQr }: { r: Routine; map: Map<string, Exercise>; last?: number; onClose: () => void; onStart: () => void; onEdit: () => void; onShare: () => void; onQr: () => void }) {
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong className="ellipsis">{r.name}</strong>
        <button className="btn ghost" onClick={onEdit}>Düzenle</button>
      </div>
      <div className="sheet-body">
        <div className="card">
          <p className="muted small">{r.folder ?? 'Rutinlerim'} · {r.exercises.length} hareket · {r.exercises.reduce((a, e) => a + e.sets, 0)} set{last ? ` · son: ${fmtDate(last)}` : ''}</p>
          <table className="sets read">
            <tbody>
              {r.exercises.map((e, j) => (
                <tr key={j}>
                  <td>{map.get(e.exerciseId)?.name ?? e.exerciseId}{e.superset && <span className="ss-tag" style={{ marginLeft: 6 }}>S{e.superset.toUpperCase()}</span>}</td>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtPlan(e.reps, e.sets)}</td>
                  <td className="muted tiny" style={{ whiteSpace: 'nowrap' }}>{e.restSec ? fmtRest(e.restSec) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn primary block" onClick={onStart}>Başlat</button>
        <div className="row">
          <button className="btn grow" onClick={onEdit}>Düzenle</button>
          <button className="btn grow" onClick={onShare}>Paylaş</button>
          <button className="btn grow" onClick={onQr}>QR kod</button>
        </div>
      </div>
    </div>
  )
}
