import { ClipboardList, Dumbbell, History as HistoryIcon, TrendingUp, Trophy } from 'lucide-react'
import { didSaveFail, useAppState } from './store'
import { useRoute, type Route } from './device'
import { showResult, useResult } from './flash'
import { sessionSetCount, sessionVolume } from './logic'
import { fmtKg, fmtNum } from './format'
import { Sheet, Toaster } from './ui'
import { Home } from './screens/Home'
import { Workout } from './screens/Workout'
import { History } from './screens/History'
import { Progress } from './screens/Progress'
import { Plan } from './screens/Plan'
import { Welcome } from './screens/Welcome'
import { Builder } from './screens/Builder'
import { AddExercises } from './screens/AddExercises'

const TABS = [
  { href: '#/', name: 'home', label: 'Allenamento', Icon: Dumbbell },
  { href: '#/progressi', name: 'progress', label: 'Progressi', Icon: TrendingUp },
  { href: '#/storico', name: 'history', label: 'Storico', Icon: HistoryIcon },
  { href: '#/scheda', name: 'plan', label: 'Scheda', Icon: ClipboardList },
] as const

export default function App() {
  const state = useAppState()
  const route = useRoute()
  // Al primo avvio si sceglie da dove partire (il costruttore della scheda resta raggiungibile)
  const showWelcome = !state.onboarded && route.name !== 'builder'
  const fullScreen =
    showWelcome || route.name === 'workout' || route.name === 'builder' || route.name === 'add'

  return (
    <>
      {didSaveFail() && (
        <p className="save-warning" role="alert">
          Non riesco a salvare i dati su questo telefono. Libera un po' di spazio o esporta un backup.
        </p>
      )}
      {showWelcome ? <Welcome /> : screen(route)}
      {!fullScreen && (
        <nav className="tabbar" aria-label="Sezioni">
          {TABS.map(({ href, name, label, Icon }) => {
            const current = route.name === name
            return (
              <a key={name} className="tab" href={href} aria-current={current ? 'page' : undefined}>
                <Icon size={24} strokeWidth={current ? 2.2 : 1.8} aria-hidden="true" />
                {label}
              </a>
            )
          })}
        </nav>
      )}
      <ResultSheet />
      <Toaster />
    </>
  )

  // Funzione e non componente: cosi' i campi non perdono il fuoco a ogni modifica
  function screen(route: Route) {
    switch (route.name) {
      case 'workout':
        return <Workout key={route.dayId} state={state} dayId={route.dayId} />
      case 'progress':
        return <Progress state={state} />
      case 'history':
        return <History state={state} />
      case 'plan':
        return <Plan state={state} />
      case 'builder':
        return <Builder state={state} />
      case 'add':
        return <AddExercises key={route.dayId} state={state} dayId={route.dayId} />
      default:
        return <Home state={state} />
    }
  }
}

// Riepilogo mostrato appena salvi un allenamento
function ResultSheet() {
  const result = useResult()
  const close = () => showResult(null)
  const s = result?.session
  const volume = s ? sessionVolume(s) : 0

  return (
    <div data-color={s?.color}>
      <Sheet open={!!result} onClose={close} labelledBy="result-title">
        {s && result && (
          <>
            <h2 id="result-title">Allenamento salvato</h2>
            <p>{s.dayName}, fatto. Lo trovi nello storico e nei progressi.</p>
            <dl className="sheet-stats">
              <div>
                <dt>serie</dt>
                <dd>{sessionSetCount(s)}</dd>
              </div>
              {s.durationMin != null && (
                <div>
                  <dt>minuti</dt>
                  <dd>{s.durationMin}</dd>
                </div>
              )}
              {volume > 0 && (
                <div>
                  <dt>kg sollevati</dt>
                  <dd>{fmtNum(Math.round(volume))}</dd>
                </div>
              )}
            </dl>
            {result.records.length > 0 && (
              <ul className="records" aria-label="Nuovi record">
                {result.records.map((r) => (
                  <li key={`${r.name}-${r.part ?? ''}`}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Trophy size={16} aria-hidden="true" style={{ color: 'var(--day-ink)', flex: 'none' }} />
                      Record: {r.part ?? r.name}
                    </span>
                    <span>
                      {fmtKg(r.w)} <span className="muted">(era {fmtNum(r.prev)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={close}>
                Fatto
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}
