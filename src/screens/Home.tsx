import { ChevronRight } from 'lucide-react'
import type { AppState, Session } from '../types'
import { draftProgress, lastDone, nextDayId } from '../logic'
import { fmtLongDate, fmtTime, relDay, nEx } from '../format'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export function Home({ state }: { state: AppState }) {
  const now = new Date()
  const { days, sessions, drafts } = state
  const inProgress = days.find((d) => drafts[d.id])
  const hero = inProgress ?? days.find((d) => d.id === nextDayId(days, sessions))
  const heroIdx = hero ? days.indexOf(hero) : -1

  return (
    <main className="screen">
      <header className="head">
        <h1>Allenamento</h1>
        <p>{fmtLongDate(now)}</p>
      </header>

      {hero ? (
        <section className="today" data-color={hero.color} aria-labelledby="today-title">
          <div className="today-art" aria-hidden="true">
            <span style={{ height: 18 }} />
            <span style={{ height: 30 }} />
            <span style={{ height: 44 }} />
          </div>
          <p className="today-label">{inProgress ? 'Allenamento in corso' : 'Oggi tocca a'}</p>
          <h2 id="today-title">{hero.name}</h2>
          <ul className="today-meta">
            <li>Giorno {heroIdx + 1}</li>
            <li>
              {nEx(hero.exercises.length)} ·{' '}
              {hero.exercises.reduce((n, ex) => n + ex.sets, 0)} serie
            </li>
            <li>{heroStatus(state, hero.id)}</li>
          </ul>
          <a className="btn btn-primary btn-block" href={`#/allenamento/${hero.id}`}>
            {inProgress ? 'Riprendi allenamento' : 'Inizia allenamento'}
          </a>
        </section>
      ) : (
        <div className="empty">
          <h2>La scheda è vuota</h2>
          <p>Aggiungi un giorno e i suoi esercizi dalla sezione Scheda.</p>
        </div>
      )}

      <Week state={state} now={now} />

      <h2 className="section-title">La tua scheda</h2>
      <nav className="group" aria-label="Giorni della scheda">
        {days.map((day, i) => {
          const last = lastDone(sessions, day.id)
          const draft = drafts[day.id]
          const sets = day.exercises.reduce((n, ex) => n + ex.sets, 0)
          return (
            <a key={day.id} className="row" href={`#/allenamento/${day.id}`} data-color={day.color}>
              <span className="dot" aria-hidden="true" />
              <span className="row-main">
                <span className="row-title">{day.name}</span>
                <span className="row-sub">
                  Giorno {i + 1} · {nEx(day.exercises.length)} · {sets} serie
                  <br />
                  {last ? `Ultima volta ${relDay(last.date, now)}` : 'Non ancora fatto qui'}
                </span>
              </span>
              {draft && <span className="badge">In corso</span>}
              <ChevronRight className="row-end" size={20} aria-hidden="true" />
            </a>
          )
        })}
      </nav>
    </main>
  )
}

function heroStatus(state: AppState, dayId: string) {
  const day = state.days.find((d) => d.id === dayId)!
  const draft = state.drafts[dayId]
  if (draft) {
    const { done, total } = draftProgress(day, draft)
    return `Iniziato alle ${fmtTime(draft.startedAt)} · ${done} di ${total} serie`
  }
  const last = lastDone(state.sessions, dayId)
  return last ? `Ultima volta ${relDay(last.date)}` : 'Primo allenamento con Scheda'
}

// La settimana corrente, da lunedi' a domenica, con i giorni in cui ti sei allenato
function Week({ state, now }: { state: AppState; now: Date }) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const real = state.sessions.filter((s) => s.source !== 'note')
  const cells = WEEKDAYS.map((letter, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const session = real.find((s) => sameDay(new Date(s.date), date))
    return { letter, date, session }
  })
  const count = cells.filter((c) => c.session).length

  return (
    <>
      <h2 className="section-title">
        Questa settimana
        <small>
          {count === 0 ? 'Nessun allenamento' : count === 1 ? '1 allenamento' : `${count} allenamenti`}
        </small>
      </h2>
      <ol className="week" style={{ listStyle: 'none', margin: 0 }}>
        {cells.map(({ letter, date, session }) => {
          const color = session ? colorOf(state, session) : undefined
          const isToday = sameDay(date, now)
          const full = date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' })
          return (
            <li
              key={date.toISOString()}
              className={`week-day${isToday ? ' is-today' : ''}`}
              data-color={color}
            >
              <span aria-hidden="true">{letter}</span>
              <span className={`pip${session ? ' is-trained' : ''}`} aria-hidden="true" />
              <span className="sr-only">
                {full}
                {isToday ? ', oggi' : ''}: {session ? session.dayName : 'riposo'}
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const colorOf = (state: AppState, s: Session) =>
  state.days.find((d) => d.id === s.dayId)?.color ?? s.color
