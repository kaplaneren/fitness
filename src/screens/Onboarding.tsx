import { useState } from 'react'
import { getProfile, setKV, type Profile } from '../db'
import NumBox from '../components/NumBox'
import { FLAG_INFO, type Flag } from '../data/exercises'
import { useProfile } from '../hooks'
import type { Goal } from '../lib/program'
import EquipmentPicker from '../components/EquipmentPicker'
import Wizard from './Wizard'

// İlk açılış: veri yokken bir kez gösterilir. Profil temel bilgileri, hedef, ekipman ve sağlık kısıtları alınır,
// sonra program sihirbazı bu bilgilerle açılır. Her adım atlanabilir; hepsi sonradan Profil'den değişir.

const update = async (patch: Partial<Profile>) => setKV('profile', { ...(await getProfile()), ...patch })
const GOAL_TO_DIET: Record<Goal, Profile['goal']> = { yag: 'cut', kas: 'bulk', guc: 'maintain' }

function Num({ label, value, step, onChange }: { label: string; value: number; step?: string; onChange: (v: number) => void }) {
  return (
    <label className="field">{label}
      <NumBox integer={step == null} value={value} onChange={(v) => { if (v && v > 0) onChange(v) }} />
    </label>
  )
}

const STEPS = 5

export default function Onboarding({ onDone, onRestore }: { onDone: () => void; onRestore: () => void }) {
  const profile = useProfile()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<Goal>('yag')
  const [wizard, setWizard] = useState(false)
  const finish = async () => { await setKV('onboarded', true); onDone() }
  const next = () => setStep((s) => s + 1)
  const toggle = (f: Flag) => update({ restrictions: profile.restrictions.includes(f) ? profile.restrictions.filter((x) => x !== f) : [...profile.restrictions, f] })

  if (wizard) return <Wizard initialGoal={goal} onClose={() => setWizard(false)} onSaved={finish} />

  return (
    <div className="onboard">
      {step > 0 && <div className="steps">{Array.from({ length: STEPS }, (_, i) => <span key={i} className={i < step ? 'on' : ''} />)}</div>}

      {step === 0 && (
        <>
          <span className="eyebrow">Hoş geldin</span>
          <h1 lang="en">Fitness</h1>
          <p>Antrenmanlarını kaydeder, her harekette bir sonraki ağırlığı önerir, ilerlemeni ve beslenmeni takip eder.</p>
          <div className="card">
            <p className="small">Birkaç soruyla sana uygun bir program hazırlayalım. Bir dakika sürer, hepsini sonra Profil'den değiştirebilirsin.</p>
            <p className="muted small">Verilerin sadece bu cihazda saklanır, hiçbir sunucuya gönderilmez.</p>
          </div>
          <div className="foot" style={{ flexDirection: 'column' }}>
            <button className="btn primary block" onClick={next}>Başla</button>
            <button className="btn ghost block" onClick={async () => { await setKV('onboarded', true); onRestore() }}>Yedeğim var, geri yükleyeceğim</button>
            <button className="link small" onClick={finish}>Atla, kendim keşfederim</button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h2>Seni tanıyalım</h2>
          <p className="muted small">Kalori hedefi, güç seviyesi ve yakılan kalori bu bilgilerle hesaplanır.</p>
          <div className="card">
            <div className="seg">
              <button className={profile.sex === 'm' ? 'on' : ''} onClick={() => update({ sex: 'm' })}>Erkek</button>
              <button className={profile.sex === 'f' ? 'on' : ''} onClick={() => update({ sex: 'f' })}>Kadın</button>
            </div>
            <div className="fields">
              <Num label="Yaş" value={profile.age} onChange={(v) => update({ age: Math.round(v) })} />
              <Num label="Boy (cm)" value={profile.height} onChange={(v) => update({ height: v })} />
              <Num label="Kilo (kg)" value={profile.bodyweight} step="0.1" onChange={(v) => update({ bodyweight: v })} />
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Hedefin ne?</h2>
          <div className="check-list">
            {([
              { v: 'yag', l: 'Yağ yakımı', d: 'Kilo vermek, kası korumak. Kalori hedefi açıkla başlar.' },
              { v: 'kas', l: 'Kas kazanmak', d: 'Hacim ve görünüm. Kalori hedefi hafif fazlayla başlar.' },
              { v: 'guc', l: 'Güçlenmek', d: 'Daha ağır kaldırmak. Kalori hedefi korumada başlar.' }
            ] as { v: Goal; l: string; d: string }[]).map((g) => (
              <button key={g.v} className={`card ${goal === g.v ? 'selected' : ''}`} style={goal === g.v ? { borderColor: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent)' } : undefined} onClick={() => { setGoal(g.v); update({ goal: GOAL_TO_DIET[g.v] }) }}>
                <strong>{g.l}</strong>
                <span className="muted small">{g.d}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2>Nerede çalışıyorsun?</h2>
          <p className="muted small">Program sadece elindeki ekipmanla yapılabilen hareketlerden kurulur.</p>
          <div className="card"><EquipmentPicker value={profile.equipment} /></div>
        </>
      )}

      {step === 4 && (
        <>
          <h2>Sağlık kısıtın var mı?</h2>
          <p className="muted small">İşaretlediklerine yük bindiren hareketler yerine güvenli alternatifler seçilir, ağırlık artışı temkinli olur. Yoksa boş bırak.</p>
          <div className="card">
            {(Object.keys(FLAG_INFO) as Flag[]).map((f) => (
              <label key={f} className="toggle">
                <input type="checkbox" checked={profile.restrictions.includes(f)} onChange={() => toggle(f)} />
                <span>{FLAG_INFO[f].label}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <h2>Programını hazırlayalım</h2>
          <p>Haftada kaç gün gidebildiğini ve ne kadar vaktin olduğunu seç; bu bilgilerle sana uygun bir program kurulur.</p>
          <div className="foot" style={{ flexDirection: 'column', marginTop: 0 }}>
            <button className="btn primary block" onClick={() => setWizard(true)}>Program oluştur</button>
            <button className="btn ghost block" onClick={finish}>Kendi rutinimi yapacağım</button>
          </div>
        </>
      )}

      {step > 0 && step < STEPS && (
        <div className="foot">
          <button className="btn" onClick={() => setStep((s) => s - 1)}>Geri</button>
          <button className="btn primary" onClick={next}>Devam</button>
        </div>
      )}
      {step === STEPS && <div className="foot"><button className="btn" onClick={() => setStep((s) => s - 1)}>Geri</button></div>}
    </div>
  )
}
