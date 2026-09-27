import { useState } from 'react'
import { CalendarDays, ChevronRight, Trash2 } from 'lucide-react'
import type { AppState, Session } from '../types'
import { byDateDesc, sessionSetCount, sessionVolume } from '../logic'
import { fmtDate, fmtMonth, fmtNum, fmtSets, nEx } from '../format'
import { deleteSession } from '../store'
import { toast } from '../flash'
import { Sheet } from '../ui'

export function History({ state }: { state: AppState }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Session | null>(null)

  const sorted = byDateDesc(state.sessions)
  const real = sorted.filter((s) => s.source !== 'note')
  const notes = sorted.filter((s) => s.source === 'note')

  const months: { label: string; items: Session[] }[] = []
  for (const s of real) {
    const label = fmtMonth(s.date)
    const last = months[months.length - 1]
    if (last?.label === label) last.items.push(s)
    else months.push({ label, items: [s] })
  }

  const colorOf = (s: Session) => state.days.find((d) => d.id === s.dayId)?.color ?? s.color

  const item = (s: Session) => {
    const open = openId === s.id
    const volume = sessionVolume(s)
    const sub =
      s.source === 'note'
        ? `${nEx(s.exercises.length)} con i pesi delle note`
        : [
            `${sessionSetCount(s)} serie`,
            s.durationMin ? `${s.durationMin} min` : null,
            volume > 0 ? `${fmtNum(Math.round(volume))} kg sollevati` : null,
          ]
            .filter(Boolean)
            .join(' · ')
    return (
      <div key={s.id} className="row-wrap" data-color={colorOf(s)}>
        <button
          type="button"
          className="row"
          aria-expanded={open}
          aria-controls={`det-${s.id}`}
          onClick={() => setOpenId(open ? null : s.id)}
        >
          <span className="dot" aria-hidden="true" />
          <span className="row-main">
            <span className="row-title">
              {s.dayName} <span className="muted" style={{ fontWeight: 400 }}>· {fmtDate(s.date)}</span>
            </span>
            <span className="row-sub">{sub}</span>
          </span>
          <ChevronRight className="row-end chev" size={20} aria-hidden="true" />
        </button>
        {open && (
          <div className="detail" id={`det-${s.id}`}>
            {s.exercises.map((ex) => (
              <div key={ex.exId} className="detail-ex">
                <h3>{ex.name}</h3>
                {ex.parts && (
                  <p style={{ fontFamily: 'var(--font)' }}>
                    {ex.parts[0]} + {ex.parts[1]}
                  </p>
                )}
                <p>{fmtSets(ex.sets)}</p>
              </div>
            ))}
            <div className="detail-actions">
              <button type="button" className="btn btn-text danger" onClick={() => setToDelete(s)}>
                <Trash2 size={18} aria-hidden="true" />
                Elimina
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="screen">
      <header className="head">
        <h1>Storico</h1>
        <p>
          {real.length === 0
            ? 'Ogni allenamento salvato finisce qui'
            : real.length === 1
              ? '1 allenamento salvato'
              : `${real.length} allenamenti salvati`}
        </p>
      </header>

      {real.length === 0 && (
        <div className="empty">
          <CalendarDays size={32} aria-hidden="true" />
          <h2>Ancora nessun allenamento</h2>
          <p>Quando premi “Termina allenamento”, qui trovi data, serie e pesi di ogni sessione.</p>
        </div>
      )}

      {months.map((m) => (
        <section key={m.label} aria-label={m.label}>
          <h2 className="month">{m.label}</h2>
          <div className="group">{m.items.map(item)}</div>
        </section>
      ))}

      {notes.length > 0 && (
        <section aria-label="Punto di partenza">
          <h2 className="month" style={{ marginTop: 28 }}>
            Punto di partenza
          </h2>
          <div className="group">{notes.map(item)}</div>
          <p className="hint">
            I pesi che avevi nelle note dell'iPhone. Servono per precompilare il primo allenamento e
            come inizio dei grafici.
          </p>
        </section>
      )}

      <Sheet open={!!toDelete} onClose={() => setToDelete(null)} labelledBy="del-title">
        {toDelete && (
          <>
            <h2 id="del-title">Eliminare questo allenamento?</h2>
            <p>
              {toDelete.dayName} del {fmtDate(toDelete.date)}. Sparisce anche dai grafici e non si può
              recuperare.
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  deleteSession(toDelete.id)
                  setToDelete(null)
                  setOpenId(null)
                  toast('Allenamento eliminato')
                }}
              >
                Elimina
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setToDelete(null)}>
                Annulla
              </button>
            </div>
          </>
        )}
      </Sheet>
    </main>
  )
}
