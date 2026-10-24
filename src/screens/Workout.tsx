import { useLayoutEffect, useState } from 'react'
import { Check, ChevronLeft, CircleCheck, Plus, Timer, TrendingUp } from 'lucide-react'
import type { AppState, Day, DraftExercise, Exercise, Session } from '../types'
import { draftProgress, lastLog, progressionFor } from '../logic'
import { fmtClock, fmtKg, fmtNum, fmtSets, fmtTime, relDay, nEx } from '../format'
import {
  addSet,
  bumpWeights,
  discardDraft,
  finishDraft,
  openDraft,
  removeLastSet,
  setEntry,
  toggleDone,
} from '../store'
import { go, useWakeLock } from '../device'
import { showResult, toast } from '../flash'
import { NumberField, Pictogram, Sheet } from '../ui'
import { iconFor } from '../icons'

export function Workout({ state, dayId }: { state: AppState; dayId: string }) {
  const day = state.days.find((d) => d.id === dayId)
  const draft = state.drafts[dayId]
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  // Apre (o riallinea alla scheda) l'allenamento prima di disegnare la pagina
  useLayoutEffect(() => {
    if (day) openDraft(day.id)
  }, [day])

  useWakeLock(!!draft)

  if (!day) {
    return (
      <main className="screen">
        <div className="empty">
          <h2>Giorno non trovato</h2>
          <p>Forse l'hai eliminato dalla scheda.</p>
          <p>
            <a className="btn btn-secondary" href="#/">
              Torna all'inizio
            </a>
          </p>
        </div>
      </main>
    )
  }
  if (!draft) return null

  const idx = state.days.indexOf(day)
  const { done, total } = draftProgress(day, draft)

  const finish = (includeAll: boolean) => {
    const res = finishDraft(day.id, includeAll)
    setFinishing(false)
    if (res) {
      showResult(res)
      go('/')
    }
  }

  return (
    <div data-color={day.color}>
      <main className="screen workout">
        <div className="topbar">
          <div className="topbar-row">
            <a className="back" href="#/">
              <ChevronLeft size={26} aria-hidden="true" />
              Allenamento
            </a>
            <span className="topbar-count num">
              {done} di {total} serie
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label="Serie fatte"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <span style={{ transform: `scaleX(${total ? done / total : 0})` }} />
          </div>
        </div>

        <header className="head">
          <h1>{day.name}</h1>
          <p>
            Giorno {idx + 1} · {nEx(day.exercises.length)} · iniziato alle{' '}
            {fmtTime(draft.startedAt)}
          </p>
        </header>

        {day.exercises.length === 0 && (
          <div className="empty">
            <h2>Nessun esercizio</h2>
            <p>Aggiungi gli esercizi di questo giorno dalla sezione Scheda.</p>
          </div>
        )}

        {day.exercises.map((ex) => (
          <ExerciseBlock
            key={ex.id}
            day={day}
            ex={ex}
            draftEx={draft.exercises[ex.id]}
            sessions={state.sessions}
          />
        ))}

        <div className="discard">
          <button type="button" className="btn btn-text danger" onClick={() => setDiscarding(true)}>
            Scarta allenamento
          </button>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => setFinishing(true)}
          >
            Termina allenamento
          </button>
        </div>
      </footer>

      <Sheet open={finishing} onClose={() => setFinishing(false)} labelledBy="finish-title">
        {done > 0 ? (
          <>
            <h2 id="finish-title">Terminare l'allenamento?</h2>
            <p>
              Hai fatto {done} serie su {total}.
              {done < total && ' Salvo solo quelle segnate come fatte.'}
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={() => finish(false)}>
                Salva allenamento
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFinishing(false)}>
                Continua ad allenarti
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="finish-title">Nessuna serie segnata</h2>
            <p>
              Non hai toccato la spunta su nessuna serie. Vuoi salvare tutte le serie compilate così
              come sono?
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={() => finish(true)}>
                Salva le serie compilate
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFinishing(false)}>
                Torna all'allenamento
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={discarding} onClose={() => setDiscarding(false)} labelledBy="discard-title">
        <h2 id="discard-title">Scartare l'allenamento?</h2>
        <p>Le serie di oggi non verranno salvate. La scheda e lo storico restano come sono.</p>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setDiscarding(false)
              discardDraft(day.id)
              toast('Allenamento scartato')
              go('/')
            }}
          >
            Scarta allenamento
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDiscarding(false)}>
            Continua ad allenarti
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function ExerciseBlock({
  day,
  ex,
  draftEx,
  sessions,
}: {
  day: Day
  ex: Exercise
  draftEx?: DraftExercise
  sessions: Session[]
}) {
  const sets = draftEx?.sets ?? []
  const last = lastLog(sessions, ex.id)
  const suggestion = progressionFor(ex, sessions)
  const anyDone = sets.some((s) => s.done)
  const allDone = sets.length > 0 && sets.every((s) => s.done)
  const partLetters = ex.parts ? ['A', 'B'] : [undefined]
  const headId = `ex-${ex.id}`

  const onCheck = (i: number) => toggleDone(day.id, ex.id, i)

  return (
    <section className="ex" aria-labelledby={headId}>
      <div className="ex-head">
        <span className="ex-icon">
          <Pictogram icon={iconFor(ex)} size={34} />
        </span>
        <div className="ex-title">
          <h2 id={headId}>{ex.name}</h2>
          <div className="ex-meta">
            <span>
              {sets.length} serie
              {ex.target != null && ` · ${ex.target} rip`}
            </span>
            <span className="rest-meta">
              <Timer size={15} aria-hidden="true" />
              <span className="sr-only">Recupero</span>
              {fmtClock(ex.rest)}
            </span>
            {ex.note && <span className="badge">{ex.note}</span>}
          </div>
        </div>
        {allDone && <CircleCheck className="ex-done-mark" size={26} aria-label="Esercizio completato" />}
      </div>

      {ex.parts && (
        <p className="parts-legend">
          <span>
            <b>A</b>
            {ex.parts[0]}
          </span>
          <span>
            <b>B</b>
            {ex.parts[1]}
          </span>
        </p>
      )}

      {/* I pesi delle note sono gia' nei campi: la riga serve solo dopo un allenamento vero */}
      {last && last.session.source !== 'note' && (
        <p className="ex-last">
          Ultima volta, {relDay(last.session.date)}:{' '}
          <strong className="num">{fmtSets(last.log.sets)}</strong>
        </p>
      )}
      {!last && <p className="ex-last">Prima volta: inserisci peso e ripetizioni.</p>}

      {suggestion && !anyDone && !draftEx?.bumped && (
        <div className="suggest">
          <TrendingUp size={20} aria-hidden="true" style={{ flex: 'none', color: 'var(--day-ink)' }} />
          <p>
            {suggestion.kind === 'obiettivo'
              ? `L'ultima volta hai chiuso ${suggestion.reps} ripetizioni in tutte le serie. È ora di salire.`
              : `Hai usato lo stesso peso nelle ultime ${suggestion.times} volte. Prova a salire.`}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => bumpWeights(day.id, ex.id, suggestion.step)}
          >
            +{fmtNum(suggestion.step)} kg
          </button>
        </div>
      )}
      {!!draftEx?.bumped && !anyDone && (
        <div className="suggest">
          <p>Peso aumentato di {fmtKg(draftEx.bumped)} su tutte le serie.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => bumpWeights(day.id, ex.id, -(draftEx.bumped ?? 0))}
          >
            Annulla
          </button>
        </div>
      )}

      <div className="sets">
        <span className="sets-head" aria-hidden="true">
          #
        </span>
        <span className="sets-head" aria-hidden="true">
          {ex.bodyweight ? 'Zavorra' : 'Peso'}
        </span>
        <span className="sets-head" aria-hidden="true">
          Ripetizioni
        </span>
        <span className="sets-head" aria-hidden="true">
          Fatta
        </span>

        {sets.map((s, i) => {
          const span = ex.parts ? ' span2' : ''
          return (
            <div key={i} className={`set-row${s.done ? ' is-done' : ''}`}>
              <span className={`set-n${span}`} aria-hidden="true">
                {i + 1}
              </span>
              {partLetters.map((letter, p) => {
                const partName = ex.parts ? `, ${ex.parts[p]}` : ''
                const cells = [
                  <NumberField
                    key={`w${p}`}
                    value={s.e[p]?.w ?? null}
                    onChange={(v) => setEntry(day.id, ex.id, i, p, 'w', v)}
                    label={`Serie ${i + 1}${partName}, ${ex.bodyweight ? 'zavorra' : 'peso'} in kg`}
                    unit="kg"
                    part={letter}
                    decimals
                    placeholder={ex.bodyweight ? '0' : '–'}
                  />,
                  <NumberField
                    key={`r${p}`}
                    value={s.e[p]?.r ?? null}
                    onChange={(v) => setEntry(day.id, ex.id, i, p, 'r', v)}
                    label={`Serie ${i + 1}${partName}, ripetizioni`}
                    part={letter}
                    placeholder={ex.target != null ? String(ex.target) : ex.bodyweight ? 'max' : '–'}
                  />,
                ]
                // Nel superset la spunta sta sulla prima riga e occupa entrambe
                if (p === 0)
                  return [
                    ...cells,
                    ...(ex.parts ? [checkButton(`c${p}`, i, s.done, span, () => onCheck(i))] : []),
                  ]
                return cells
              })}
              {!ex.parts && checkButton('c', i, s.done, '', () => onCheck(i))}
            </div>
          )
        })}
      </div>

      <div className="ex-actions">
        <button type="button" className="btn btn-text" onClick={() => addSet(day.id, ex.id)}>
          <Plus size={18} aria-hidden="true" />
          Aggiungi serie
        </button>
        {sets.length > ex.sets && (
          <button type="button" className="btn btn-text" onClick={() => removeLastSet(day.id, ex.id)}>
            Togli l'ultima
          </button>
        )}
      </div>
    </section>
  )
}

function checkButton(key: string, i: number, done: boolean, span: string, onClick: () => void) {
  return (
    <button
      key={key}
      type="button"
      className={`check${span}`}
      aria-pressed={done}
      aria-label={`Serie ${i + 1} fatta`}
      onClick={onClick}
    >
      <Check size={24} strokeWidth={2.6} aria-hidden="true" />
    </button>
  )
}
