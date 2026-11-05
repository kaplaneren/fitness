import { getKV, setKV, DEFAULT_PROFILE, type Profile } from '../db'
import { GEAR, type Gear } from '../lib/equipment'

const save = async (equipment: Gear[] | null) => setKV('profile', { ...DEFAULT_PROFILE, ...(await getKV<Partial<Profile>>('profile', {})), equipment })

/** "Ekipman kısıtın var mı?" sorusu; seçim profile kaydedilir. */
export default function EquipmentPicker({ value }: { value?: Gear[] | null }) {
  const limited = Array.isArray(value)
  const toggle = (g: Gear) => save(value!.includes(g) ? value!.filter((x) => x !== g) : [...value!, g])
  return (
    <>
      <div className="seg">
        <button className={!limited ? 'on' : ''} onClick={() => save(null)}>Yok, tam salon</button>
        <button className={limited ? 'on' : ''} onClick={() => !limited && save([])}>Var</button>
      </div>
      {limited && (
        <>
          <p className="muted small">Elinde olanları işaretle; sadece bunlarla yapılabilen hareketler önerilir. Vücut ağırlığı ve lastik hareketleri her zaman uygundur.</p>
          <div className="chips wrap">
            {GEAR.map((g) => (
              <button key={g.v} className={`chip ${value!.includes(g.v) ? 'on' : ''}`} title={g.hint} onClick={() => toggle(g.v)}>{g.l}</button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
