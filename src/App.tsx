import { useState } from 'react'
import { useActiveWorkout, useNow } from './hooks'
import { fmtDuration } from './lib/calc'
import StartScreen from './screens/Start'
import HistoryScreen from './screens/History'
import ExercisesScreen from './screens/Exercises'
import ProfileScreen from './screens/Profile'
import ActiveWorkout from './screens/ActiveWorkout'

type Tab = 'start' | 'history' | 'exercises' | 'profile'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'start', label: 'Antrenman', icon: 'M4 10h2v4H4zM18 10h2v4h-2zM7 7h3v10H7zM14 7h3v10h-3zM10 11h4v2h-4z' },
  { id: 'history', label: 'Geçmiş', icon: 'M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4zm-1 4v5l4 2 .8-1.6-2.8-1.4V8z' },
  { id: 'exercises', label: 'Hareketler', icon: 'M5 5h14v2H5zM5 11h14v2H5zM5 17h10v2H5z' },
  { id: 'profile', label: 'Profil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0z' }
]

export default function App() {
  const [tab, setTab] = useState<Tab>('start')
  const [workoutOpen, setWorkoutOpen] = useState(true)
  const { workout } = useActiveWorkout()
  const now = useNow(1000, !!workout && !workoutOpen)

  return (
    <div className="app">
      <main className="main">
        {tab === 'start' && <StartScreen onStarted={() => setWorkoutOpen(true)} />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'exercises' && <ExercisesScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </main>

      {workout && !workoutOpen && (
        <button className="resume-bar" onClick={() => setWorkoutOpen(true)}>
          <span>{workout.name}</span>
          <span className="mono">{fmtDuration(now - workout.startedAt)}</span>
        </button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {workout && workoutOpen && <ActiveWorkout workout={workout} onMinimize={() => setWorkoutOpen(false)} />}
    </div>
  )
}
