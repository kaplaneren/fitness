import { useEffect, useState } from 'react'
import { useActiveWorkout, useNow, useProfile } from './hooks'
import { fmtDuration } from './lib/calc'
import { DialogHost, notify } from './components/Dialog'
import { importFromUrl } from './lib/healthImport'
import Dashboard from './screens/Dashboard'
import StartScreen from './screens/Start'
import NutritionScreen from './screens/Nutrition'
import ProgressScreen from './screens/Progress'
import ProfileScreen from './screens/Profile'
import ActiveWorkout from './screens/ActiveWorkout'
import { WorkoutDetail } from './screens/History'
import { db, type Workout } from './db'

export type Tab = 'home' | 'workout' | 'food' | 'progress' | 'profile'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Özet', icon: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z' },
  { id: 'workout', label: 'Antrenman', icon: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12' },
  { id: 'food', label: 'Beslenme', icon: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 21V3c-2 1-3 4-3 7h3' },
  { id: 'progress', label: 'İlerleme', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'profile', label: 'Profil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' }
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [workoutOpen, setWorkoutOpen] = useState(true)
  const [summary, setSummary] = useState<Workout | null>(null)
  const { workout } = useActiveWorkout()
  const profile = useProfile()
  const now = useNow(1000, !!workout && !workoutOpen)

  useEffect(() => {
    const root = document.documentElement
    if (profile.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = profile.theme
  }, [profile.theme])

  useEffect(() => { window.scrollTo(0, 0) }, [tab])
  useEffect(() => { importFromUrl().then((m) => { if (m) notify(m) }).catch(() => {}) }, [])

  return (
    <div className="app">
      <main className="main">
        {tab === 'home' && <Dashboard go={setTab} onStarted={() => setWorkoutOpen(true)} />}
        {tab === 'workout' && <StartScreen onStarted={() => setWorkoutOpen(true)} />}
        {tab === 'food' && <NutritionScreen />}
        {tab === 'progress' && <ProgressScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </main>

      {workout && !workoutOpen && (
        <button className="resume-bar" onClick={() => setWorkoutOpen(true)}>
          <span className="ellipsis">{workout.name}</span>
          <span className="num-d">{fmtDuration(now - workout.startedAt)}</span>
        </button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {workout && workoutOpen && (
        <ActiveWorkout
          workout={workout}
          onMinimize={() => setWorkoutOpen(false)}
          onFinished={async (id) => { if (id) setSummary((await db.workouts.get(id)) ?? null) }}
        />
      )}
      {summary && <WorkoutDetail w={summary} onClose={() => setSummary(null)} justFinished />}
      <DialogHost />
    </div>
  )
}
