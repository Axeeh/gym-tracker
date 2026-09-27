import { useEffect, useState } from 'react'
import { ChevronLeft, Plus, X } from 'lucide-react'
import type { AppState, ColorKey, Day, Exercise } from '../types'
import { COLORS, uid } from '../logic'
import { catalogById, customExercise, fromCatalog } from '../catalog'
import { replacePlan } from '../store'
import { go } from '../device'
import { toast } from '../flash'
import { nEx } from '../format'
import { ExercisePicker, type Custom } from './Picker'

type BuilderDay = { key: string; name: string; color: ColorKey; picks: string[]; customs: Custom[] }

const PRESETS = [
  { label: 'Push, Pull, Legs', names: ['Push', 'Pull', 'Legs'] },
  { label: 'Upper, Lower', names: ['Upper', 'Lower'] },
  { label: 'Full body', names: ['Full body'] },
  { label: 'A, B, C', names: ['Giorno A', 'Giorno B', 'Giorno C'] },
]

const makeDays = (names: string[]): BuilderDay[] =>
  names.map((name, i) => ({ key: uid(), name, color: COLORS[i % COLORS.length], picks: [], customs: [] }))

// Crea una scheda da zero: giorni, poi gli esercizi di ogni giorno, poi il riepilogo
export function Builder({ state }: { state: AppState }) {
  const [days, setDays] = useState<BuilderDay[]>(() => makeDays(PRESETS[0].names))
  // -1 = giorni, 0..n-1 = esercizi del giorno, n = riepilogo
  const [step, setStep] = useState(-1)
  const total = days.length + 2
  const current = step >= 0 && step < days.length ? days[step] : null
  const hasPlan = state.onboarded && state.days.some((d) => d.exercises.length > 0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  // Sempre sullo stato piu' recente: due tocchi rapidi non si sovrascrivono
  const patchDay = (key: string, fn: (d: BuilderDay) => Partial<BuilderDay>) =>
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...fn(d) } : d)))

  const back = () => {
    if (step > -1) setStep(step - 1)
    else go(state.onboarded ? '/scheda' : '/')
  }

  const create = () => {
    const used = new Set<string>()
    const plan: Day[] = days.map((d) => {
      // Stesso nome di un giorno esistente: stesso id, cosi' lo storico resta collegato
      const existing = state.days.find((x) => x.name.trim().toLowerCase() === d.name.trim().toLowerCase())
      const exercises: Exercise[] = [
        ...d.picks.map((id) => fromCatalog(catalogById(id)!, used)),
        ...d.customs.map((c) => customExercise(c.name, used)),
      ]
      return { id: existing?.id ?? uid(), name: d.name.trim(), color: d.color, exercises }
    })
    replacePlan(plan)
    toast('Scheda creata, buon allenamento')
    go('/')
  }

  const namesOk = days.every((d) => d.name.trim())
  const next = step < days.length - 1 ? days[step + 1] : null

  return (
    <div data-color={current?.color}>
      <main className="screen builder">
        <div className="topbar">
          <div className="topbar-row">
            <button type="button" className="back" onClick={back}>
              <ChevronLeft size={26} aria-hidden="true" />
              {step === -1 ? 'Annulla' : 'Indietro'}
            </button>
            <span className="topbar-count">
              Passo {step + 2} di {total}
            </span>
          </div>
          <div className="progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${(step + 2) / total})` }} />
          </div>
        </div>

        {step === -1 && (
          <>
            <header className="head">
              <h1>Crea la tua scheda</h1>
              <p>Prima i giorni in cui ti alleni, poi gli esercizi di ognuno.</p>
            </header>

            <span className="label" id="preset-label">
              Parti da
            </span>
            <div className="chips" role="group" aria-labelledby="preset-label">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={days.map((d) => d.name).join('|') === p.names.join('|')}
                  onClick={() => setDays(makeDays(p.names))}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <h2 className="section-title">
              I tuoi giorni <small>{days.length}</small>
            </h2>
            <div className="group">
              {days.map((d, i) => (
                <div key={d.key} className="row day-row" data-color={d.color}>
                  <span className="dot" aria-hidden="true" />
                  <input
                    className="text-input"
                    value={d.name}
                    maxLength={24}
                    aria-label={`Nome del giorno ${i + 1}`}
                    onChange={(e) => {
                      const name = e.target.value
                      patchDay(d.key, () => ({ name }))
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn plain"
                    aria-label={`Togli ${d.name || `il giorno ${i + 1}`}`}
                    disabled={days.length <= 1}
                    onClick={() => setDays((ds) => ds.filter((x) => x.key !== d.key))}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {days.length < 7 && (
                <div className="row-wrap">
                  <button
                    type="button"
                    className="row add-row"
                    onClick={() =>
                      setDays((ds) => [
                        ...ds,
                        ...makeDays([`Giorno ${ds.length + 1}`]).map((d) => ({
                          ...d,
                          color: COLORS[ds.length % COLORS.length],
                        })),
                      ])
                    }
                  >
                    <Plus size={20} aria-hidden="true" />
                    Aggiungi un giorno
                  </button>
                </div>
              )}
            </div>
            <p className="hint">Puoi cambiare nomi, colori e ordine anche dopo, dalla sezione Scheda.</p>
          </>
        )}

        {current && (
          <>
            <header className="head">
              <h1 className="day-title">{current.name}</h1>
              <p>
                Tocca gli esercizi di questo giorno, nell'ordine in cui li fai.{' '}
                {current.picks.length + current.customs.length > 0 &&
                  `Scelti: ${current.picks.length + current.customs.length}.`}
              </p>
            </header>
            <ExercisePicker
              key={current.key}
              dayName={current.name}
              picked={current.picks}
              onToggle={(id) =>
                patchDay(current.key, (d) => ({
                  picks: d.picks.includes(id) ? d.picks.filter((x) => x !== id) : [...d.picks, id],
                }))
              }
              customs={current.customs}
              onAddCustom={(name) =>
                patchDay(current.key, (d) => ({ customs: [...d.customs, { id: uid(), name }] }))
              }
              onRemoveCustom={(id) =>
                patchDay(current.key, (d) => ({ customs: d.customs.filter((c) => c.id !== id) }))
              }
            />
          </>
        )}

        {step === days.length && (
          <>
            <header className="head">
              <h1>La tua scheda</h1>
              <p>Controlla e crea. Serie, ripetizioni e recupero li cambi quando vuoi.</p>
            </header>
            <div className="group">
              {days.map((d, i) => {
                const names = [
                  ...d.picks.map((id) => catalogById(id)!.name),
                  ...d.customs.map((c) => c.name),
                ]
                return (
                  <button
                    key={d.key}
                    type="button"
                    className="row"
                    data-color={d.color}
                    onClick={() => setStep(i)}
                  >
                    <span className="dot" aria-hidden="true" />
                    <span className="row-main">
                      <span className="row-title">{d.name}</span>
                      <span className="row-sub">
                        {names.length
                          ? `${nEx(names.length)}: ${names.join(', ')}`
                          : 'Nessun esercizio: potrai aggiungerli dopo'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            {hasPlan && (
              <p className="hint">
                Sostituisce la scheda attuale. Lo storico dei tuoi allenamenti resta.
              </p>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          {step === -1 && (
            <button type="button" className="btn btn-primary btn-block" disabled={!namesOk} onClick={() => setStep(0)}>
              Scegli gli esercizi
            </button>
          )}
          {current && (
            <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(step + 1)}>
              {next ? `Avanti: ${next.name}` : 'Rivedi la scheda'}
            </button>
          )}
          {step === days.length && (
            <button type="button" className="btn btn-primary btn-block" onClick={create}>
              Crea la scheda
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
