import { useMemo, useState } from 'react'
import { MUSCLE_GROUPS, type Exercise } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import FlagBadges from './FlagBadges'

export function useFilteredExercises(query: string, group: string) {
  const { list } = useExercises()
  return useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    const g = MUSCLE_GROUPS.find((x) => x.name === group)
    return list.filter((e) =>
      (!q || e.name.toLocaleLowerCase('tr').includes(q)) &&
      (!g || e.primary.some((m) => g.muscles.includes(m))))
  }, [list, query, group])
}

export function GroupChips({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  return (
    <div className="chips">
      {['Tümü', ...MUSCLE_GROUPS.map((g) => g.name)].map((g) => (
        <button key={g} className={`chip ${value === g || (!value && g === 'Tümü') ? 'on' : ''}`} onClick={() => onChange(g === 'Tümü' ? '' : g)}>{g}</button>
      ))}
    </div>
  )
}

export default function ExercisePicker({ onPick, onClose, multi = true }: { onPick: (ids: string[]) => void; onClose: () => void; multi?: boolean }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const list = useFilteredExercises(query, group)
  const profile = useProfile()

  const toggle = (e: Exercise) => {
    if (!multi) { onPick([e.id]); return }
    setSel((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]))
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Vazgeç</button>
        <strong>Hareket seç</strong>
        <button className="btn ghost" disabled={!sel.length} onClick={() => onPick(sel)}>Ekle{sel.length ? ` (${sel.length})` : ''}</button>
      </div>
      <div className="sheet-body">
        <input className="input" placeholder="Ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <GroupChips value={group} onChange={setGroup} />
        <ul className="list">
          {list.map((e) => (
            <li key={e.id} className={sel.includes(e.id) ? 'selected' : ''} onClick={() => toggle(e)}>
              <div>
                <div>{e.name}</div>
                <FlagBadges flags={e.flags} active={profile.restrictions} />
              </div>
              {sel.includes(e.id) && <span className="check">{sel.indexOf(e.id) + 1}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
