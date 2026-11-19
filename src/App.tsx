import { useEffect, useRef } from 'react'
import { ClipboardList, Dumbbell, FileDown, History as HistoryIcon, TrendingUp, Trophy } from 'lucide-react'
import { didSaveFail, getState, replacePlan, restorePlan, useAppState } from './store'
import { replaceRoute, selection, useRoute, type Route } from './device'
import { showImport, showResult, toast, useImportNotice, useResult } from './flash'
import { sessionSetCount, sessionVolume } from './logic'
import { fmtKg, fmtNum, nDays, nEx } from './format'
import { realCount } from './backup'
import { decodePlan, extractShareToken, linkImportedPlan, plansEqual } from './share'
import { exportSessionPdf } from './pdf'
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
  const importingRef = useRef<string | null>(null)
  const shareToken = route.name === 'import' ? route.token : extractShareToken(location)

  useEffect(() => {
    if (shareToken === null) {
      importingRef.current = null
      return
    }
    if (importingRef.current === shareToken) return
    importingRef.current = shareToken

    void (async () => {
      const imported = shareToken ? await decodePlan(shareToken) : null
      if (!imported) {
        replaceRoute('/')
        toast('Questo link non contiene una scheda valida')
        return
      }
      const prev = getState()
      const hadPlan = prev.onboarded && prev.days.length > 0
      const prevPlan = hadPlan
        ? { days: structuredClone(prev.days), drafts: structuredClone(prev.drafts) }
        : null
      const linked = linkImportedPlan(imported, prev)
      const changed = !prevPlan || !plansEqual(prevPlan.days, linked)

      replacePlan(linked)
      selection.planDayId = linked[0]?.id
      replaceRoute('/')
      showImport({
        days: linked,
        previous: prevPlan && changed ? prevPlan : null,
        hadSessions: realCount(prev) > 0,
      })
    })()
  }, [shareToken])

  // Al primo avvio si sceglie da dove partire (costruttore e import da link restano raggiungibili)
  const showWelcome = !state.onboarded && route.name !== 'builder' && shareToken === null
  const fullScreen =
    showWelcome ||
    route.name === 'workout' ||
    route.name === 'builder' ||
    route.name === 'add' ||
    shareToken !== null

  return (
    <>
      {didSaveFail() && (
        <p className="save-warning" role="alert">
          Non riesco a salvare i dati su questo telefono. Libera un po' di spazio o esporta un backup.
        </p>
      )}
      {shareToken !== null ? (
        <main className="screen" aria-busy="true" />
      ) : showWelcome ? (
        <Welcome />
      ) : (
        screen(route)
      )}
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
      <ResultSheet days={state.days} />
      <ImportSheet />
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

// Conferma mostrata dopo l'importazione automatica di una scheda da link
function ImportSheet() {
  const imp = useImportNotice()
  const close = () => showImport(null)
  const totalEx = imp ? imp.days.reduce((n, d) => n + d.exercises.length, 0) : 0

  return (
    <Sheet open={!!imp} onClose={close} labelledBy="import-title">
      {imp && (
        <>
          <h2 id="import-title">Scheda importata</h2>
          <p>
            {nDays(imp.days.length)} e {nEx(totalEx)} pronti per l'allenamento.
            {imp.hadSessions ? ' Lo storico dei tuoi allenamenti è rimasto intatto.' : ''}
          </p>
          <ul className="share-days" aria-label="Giorni importati">
            {imp.days.map((d) => (
              <li key={d.id} data-color={d.color}>
                <span className="share-day-name">
                  <span className="dot" aria-hidden="true" />
                  {d.name}
                </span>
                <span>{nEx(d.exercises.length)}</span>
              </li>
            ))}
          </ul>
          <div className="sheet-actions">
            <button type="button" className="btn btn-primary" onClick={close}>
              {imp.previous ? 'Usa questa scheda' : 'Inizia'}
            </button>
            {imp.previous && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  restorePlan(imp.previous!.days, imp.previous!.drafts)
                  selection.planDayId = imp.previous!.days[0]?.id
                  close()
                  toast('Scheda precedente ripristinata')
                }}
              >
                Ripristina la tua scheda
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}

// Riepilogo mostrato appena salvi un allenamento
function ResultSheet({ days }: { days: ReturnType<typeof useAppState>['days'] }) {
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => exportSessionPdf(s, { days, records: result.records })}
              >
                <FileDown size={18} aria-hidden="true" />
                Esporta PDF
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}
