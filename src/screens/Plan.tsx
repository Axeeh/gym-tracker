import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronRight, Copy, Download, Plus, Trash2, Upload, Wand2 } from 'lucide-react'
import type { AppState, ColorKey, Day, Exercise } from '../types'
import { COLORS } from '../logic'
import { fmtClock, fmtDate, fmtNum, planAsText, relDay } from '../format'
import {
  addDay,
  deleteDay,
  deleteExercise,
  moveExercise,
  replaceState,
  updateDay,
  updateExercise,
} from '../store'
import { toast } from '../flash'
import { exportBackup, readBackup, realCount } from '../backup'
import { selection } from '../device'
import { Pictogram, Seg, Sheet, Stepper } from '../ui'
import { ICON_KEYS, ICONS, iconFor } from '../icons'

const COLOR_NAMES: Record<ColorKey, string> = {
  corallo: 'Corallo',
  blu: 'Blu',
  verde: 'Verde',
  viola: 'Viola',
  giallo: 'Giallo',
  rosa: 'Rosa',
}

type Confirm =
  | { kind: 'exercise'; day: Day; ex: Exercise }
  | { kind: 'day'; day: Day }
  | { kind: 'import'; next: AppState }
  | null

export function Plan({ state }: { state: AppState }) {
  const { days } = state
  const [dayId, setDayIdState] = useState<string | undefined>(selection.planDayId ?? days[0]?.id)
  const setDayId = (id: string | undefined) => {
    selection.planDayId = id
    setDayIdState(id)
  }
  const day = days.find((d) => d.id === dayId) ?? days[0]
  const [openEx, setOpenEx] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onBackupFile = async (file: File | undefined) => {
    if (!file) return
    const next = await readBackup(file)
    if (next) setConfirm({ kind: 'import', next })
    else toast('Questo file non è un backup di Scheda')
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(planAsText(state.days, state.sessions))
      toast('Scheda copiata, puoi incollarla nelle note')
    } catch {
      toast('Non sono riuscito a copiare')
    }
  }

  return (
    <main className="screen">
      <header className="head">
        <h1>Scheda</h1>
        <p>I tuoi giorni, gli esercizi e le serie</p>
      </header>

      {day && (
        <>
          <Seg
            label="Giorno"
            value={day.id}
            onChange={(v) => {
              setDayId(v)
              setOpenEx(null)
            }}
            options={days.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
          />

          <div data-color={day.color}>
            <div className="day-head">
              <label>
                <span className="label">Nome del giorno</span>
                <input
                  className="text-input"
                  value={day.name}
                  maxLength={24}
                  onChange={(e) => updateDay(day.id, { name: e.target.value })}
                  onBlur={(e) => !e.target.value.trim() && updateDay(day.id, { name: 'Giorno' })}
                />
              </label>
              <div>
                <span className="label" id="color-label">
                  Colore
                </span>
                <div className="swatches" role="group" aria-labelledby="color-label">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="swatch"
                      data-color={c}
                      aria-pressed={day.color === c}
                      aria-label={COLOR_NAMES[c]}
                      onClick={() => updateDay(day.id, { color: c })}
                    >
                      {day.color === c && <Check size={20} strokeWidth={2.6} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <h2 className="section-title">
              Esercizi <small>{day.exercises.length}</small>
            </h2>
            <div className="group">
              {day.exercises.map((ex, i) => {
                const open = openEx === ex.id
                return (
                  <div key={ex.id} className="row-wrap">
                    <button
                      type="button"
                      className="row"
                      aria-expanded={open}
                      aria-controls={`edit-${ex.id}`}
                      onClick={() => setOpenEx(open ? null : ex.id)}
                    >
                      <span className="ex-icon small">
                        <Pictogram icon={iconFor(ex)} size={30} />
                      </span>
                      <span className="row-main">
                        <span className="row-title">{ex.name || 'Senza nome'}</span>
                        <span className="row-sub">
                          {ex.sets} serie · {ex.target != null ? `${ex.target} rip` : 'senza obiettivo'} ·
                          recupero {fmtClock(ex.rest)}
                          {ex.parts ? ' · superset' : ''}
                        </span>
                      </span>
                      <ChevronRight className="row-end chev" size={20} aria-hidden="true" />
                    </button>
                    {open && (
                      <ExerciseEditor
                        day={day}
                        ex={ex}
                        first={i === 0}
                        lastOne={i === day.exercises.length - 1}
                        onDelete={() => setConfirm({ kind: 'exercise', day, ex })}
                      />
                    )}
                  </div>
                )
              })}
              <div className="row-wrap">
                <a className="row add-row" href={`#/scheda/aggiungi/${day.id}`}>
                  <Plus size={20} aria-hidden="true" />
                  Aggiungi esercizi
                </a>
              </div>
            </div>

            <div className="discard">
              <button
                type="button"
                className="btn btn-text danger"
                disabled={days.length <= 1}
                onClick={() => setConfirm({ kind: 'day', day })}
              >
                Elimina il giorno “{day.name}”
              </button>
            </div>
          </div>
        </>
      )}

      <div className="plan-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setDayId(addDay())
            setOpenEx(null)
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Aggiungi un giorno
        </button>
        <a className="btn btn-secondary" href="#/crea">
          <Wand2 size={20} aria-hidden="true" />
          Crea una nuova scheda
        </a>
      </div>

      <h2 className="section-title">I tuoi dati</h2>
      <div className="group">
        <button type="button" className="row" onClick={exportBackup}>
          <Download size={22} aria-hidden="true" className="row-end" />
          <span className="row-main">
            <span className="row-title">Esporta un backup</span>
            <span className="row-sub">
              {state.lastBackup ? `Ultimo backup ${relDay(state.lastBackup)}` : 'Non hai ancora fatto un backup'}
            </span>
          </span>
        </button>
        <button type="button" className="row" onClick={() => fileRef.current?.click()}>
          <Upload size={22} aria-hidden="true" className="row-end" />
          <span className="row-main">
            <span className="row-title">Importa un backup</span>
            <span className="row-sub">Sostituisce i dati di questo telefono</span>
          </span>
        </button>
        <button type="button" className="row" onClick={copyText}>
          <Copy size={22} aria-hidden="true" className="row-end" />
          <span className="row-main">
            <span className="row-title">Copia la scheda come testo</span>
            <span className="row-sub">Con gli ultimi pesi, nel formato delle tue note</span>
          </span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          onBackupFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p className="hint">
        I dati restano salvati su questo telefono. Ogni tanto esporta un backup e tienilo in File o su
        iCloud Drive.
      </p>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} labelledBy="confirm-title">
        {confirm?.kind === 'exercise' && (
          <>
            <h2 id="confirm-title">Eliminare “{confirm.ex.name}”?</h2>
            <p>Esce dalla scheda. Gli allenamenti già salvati restano nello storico.</p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  deleteExercise(confirm.day.id, confirm.ex.id)
                  setOpenEx(null)
                  setConfirm(null)
                  toast('Esercizio eliminato')
                }}
              >
                Elimina esercizio
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Annulla
              </button>
            </div>
          </>
        )}
        {confirm?.kind === 'day' && (
          <>
            <h2 id="confirm-title">Eliminare “{confirm.day.name}”?</h2>
            <p>
              Il giorno e i suoi esercizi ({confirm.day.exercises.length}) escono dalla scheda. Gli
              allenamenti già salvati restano nello storico.
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  deleteDay(confirm.day.id)
                  setDayId(days.find((d) => d.id !== confirm.day.id)?.id)
                  setConfirm(null)
                  toast('Giorno eliminato')
                }}
              >
                Elimina giorno
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Annulla
              </button>
            </div>
          </>
        )}
        {confirm?.kind === 'import' && (
          <>
            <h2 id="confirm-title">Sostituire i dati?</h2>
            <p>
              Il backup contiene {confirm.next.days.length} giorni e {realCount(confirm.next)}{' '}
              allenamenti
              {confirm.next.lastBackup ? `, salvato il ${fmtDate(confirm.next.lastBackup)}` : ''}. I
              dati attuali di questo telefono ({realCount(state)} allenamenti) verranno sostituiti.
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  replaceState(confirm.next)
                  setDayId(confirm.next.days[0]?.id)
                  setConfirm(null)
                  toast('Backup importato')
                }}
              >
                Sostituisci i dati
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Annulla
              </button>
            </div>
          </>
        )}
      </Sheet>
    </main>
  )
}

function ExerciseEditor({
  day,
  ex,
  first,
  lastOne,
  onDelete,
}: {
  day: Day
  ex: Exercise
  first: boolean
  lastOne: boolean
  onDelete: () => void
}) {
  const update = (patch: Partial<Exercise>) => updateExercise(day.id, ex.id, patch)
  const current = iconFor(ex)

  return (
    <div className="editor" id={`edit-${ex.id}`}>
      <label>
        <span className="label">Nome</span>
        <input
          className="text-input"
          value={ex.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && update({ name: 'Esercizio' })}
        />
      </label>
      <div>
        <span className="label" id={`icon-${ex.id}`}>
          Icona
        </span>
        <div className="icon-grid" role="group" aria-labelledby={`icon-${ex.id}`}>
          {ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="icon-choice"
              aria-pressed={current === key}
              aria-label={ICONS[key].label}
              title={ICONS[key].label}
              onClick={() => update({ icon: key })}
            >
              <Pictogram icon={key} size={30} />
            </button>
          ))}
        </div>
      </div>
      <label>
        <span className="label">Nota</span>
        <input
          className="text-input"
          placeholder="Facoltativa, es. con straps"
          value={ex.note ?? ''}
          onChange={(e) => update({ note: e.target.value || undefined })}
        />
      </label>

      <div className="editor-row">
        <span>Serie</span>
        <Stepper value={ex.sets} min={1} max={10} step={1} label="serie" onChange={(v) => update({ sets: v })} />
      </div>
      <div className="editor-row">
        <span>
          Ripetizioni obiettivo
          <small>{ex.target == null ? 'Nessun obiettivo, es. max' : 'Un numero unico'}</small>
        </span>
        <Stepper
          value={ex.target ?? 0}
          min={0}
          max={50}
          step={1}
          label="ripetizioni obiettivo"
          format={(v) => (v === 0 ? '–' : String(v))}
          onChange={(v) => update({ target: v === 0 ? null : v })}
        />
      </div>
      <div className="editor-row">
        <span>Recupero</span>
        <Stepper
          value={ex.rest}
          min={0}
          max={600}
          step={15}
          label="recupero"
          format={fmtClock}
          onChange={(v) => update({ rest: v })}
        />
      </div>
      <div className="editor-row">
        <span>
          Aumento di peso
          <small>Proposto quando chiudi l'obiettivo</small>
        </span>
        <Stepper
          value={ex.step}
          min={0}
          max={20}
          step={0.5}
          label="aumento di peso"
          format={(v) => `${fmtNum(v)} kg`}
          onChange={(v) => update({ step: v })}
        />
      </div>

      <label className="editor-row">
        <span>
          Superset
          <small>Due esercizi fatti in coppia</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={!!ex.parts}
          onChange={(e) => update({ parts: e.target.checked ? ['Esercizio A', 'Esercizio B'] : undefined })}
        />
      </label>
      {ex.parts && (
        <div className="editor-2col">
          {ex.parts.map((name, p) => (
            <label key={p}>
              <span className="label">Parte {p === 0 ? 'A' : 'B'}</span>
              <input
                className="text-input"
                value={name}
                onChange={(e) => {
                  const parts: [string, string] = [...ex.parts!]
                  parts[p] = e.target.value
                  update({ parts })
                }}
              />
            </label>
          ))}
        </div>
      )}

      <label className="editor-row">
        <span>
          Corpo libero
          <small>Il peso diventa zavorra aggiunta</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={!!ex.bodyweight}
          onChange={(e) => update({ bodyweight: e.target.checked || undefined })}
        />
      </label>

      <div className="editor-tools">
        <div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Sposta su"
            disabled={first}
            onClick={() => moveExercise(day.id, ex.id, -1)}
          >
            <ArrowUp size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Sposta giù"
            disabled={lastOne}
            onClick={() => moveExercise(day.id, ex.id, 1)}
          >
            <ArrowDown size={20} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className="btn btn-text danger" onClick={onDelete}>
          <Trash2 size={18} aria-hidden="true" />
          Elimina
        </button>
      </div>
    </div>
  )
}
