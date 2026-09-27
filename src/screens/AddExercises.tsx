import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { AppState, Exercise } from '../types'
import { uid } from '../logic'
import { catalogById, customExercise, fromCatalog } from '../catalog'
import { addExercises } from '../store'
import { go, selection } from '../device'
import { toast } from '../flash'
import { ExercisePicker, type Custom } from './Picker'

// Aggiunge esercizi del catalogo (o creati a mano) a un giorno della scheda
export function AddExercises({ state, dayId }: { state: AppState; dayId: string }) {
  const day = state.days.find((d) => d.id === dayId)
  const [picks, setPicks] = useState<string[]>([])
  const [customs, setCustoms] = useState<Custom[]>([])

  if (!day) {
    return (
      <main className="screen">
        <div className="empty">
          <h2>Giorno non trovato</h2>
          <p>
            <a className="btn btn-secondary" href="#/scheda">
              Torna alla scheda
            </a>
          </p>
        </div>
      </main>
    )
  }

  // Esercizi del catalogo gia' nel giorno (anche i doppioni hanno id "catalogo-xxxx")
  const present = new Set(
    day.exercises.map((ex) => ex.id.replace(/-[a-z0-9]{12,}$/, '')).filter((id) => catalogById(id)),
  )
  const count = picks.length + customs.length

  const back = () => {
    selection.planDayId = day.id
    go('/scheda')
  }

  const confirm = () => {
    const used = new Set(state.days.flatMap((d) => d.exercises.map((ex) => ex.id)))
    const added: Exercise[] = [
      ...picks.map((id) => fromCatalog(catalogById(id)!, used)),
      ...customs.map((c) => customExercise(c.name, used)),
    ]
    addExercises(day.id, added)
    toast(added.length === 1 ? 'Esercizio aggiunto' : `${added.length} esercizi aggiunti`)
    back()
  }

  return (
    <div data-color={day.color}>
      <main className="screen builder">
        <div className="topbar">
          <div className="topbar-row">
            <button type="button" className="back" onClick={back}>
              <ChevronLeft size={26} aria-hidden="true" />
              Scheda
            </button>
          </div>
        </div>
        <header className="head">
          <h1 className="day-title">Aggiungi a {day.name}</h1>
          <p>Tocca gli esercizi da aggiungere, in fondo al giorno.</p>
        </header>
        <ExercisePicker
          dayName={day.name}
          picked={picks}
          present={present}
          onToggle={(id) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
          customs={customs}
          onAddCustom={(name) => setCustoms((c) => [...c, { id: uid(), name }])}
          onRemoveCustom={(id) => setCustoms((c) => c.filter((x) => x.id !== id))}
        />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <button type="button" className="btn btn-primary btn-block" disabled={count === 0} onClick={confirm}>
            {count === 0 ? 'Scegli almeno un esercizio' : count === 1 ? 'Aggiungi 1 esercizio' : `Aggiungi ${count} esercizi`}
          </button>
        </div>
      </footer>
    </div>
  )
}
