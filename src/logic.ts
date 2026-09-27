import type {
  AppState,
  Day,
  Draft,
  DraftSet,
  Entry,
  Exercise,
  LoggedExercise,
  Session,
} from './types'

export const COLORS = ['corallo', 'blu', 'verde', 'viola', 'giallo', 'rosa'] as const

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const partCount = (ex: { parts?: [string, string] }) => (ex.parts ? 2 : 1)

// Sessioni dalla piu' recente alla piu' vecchia
export function byDateDesc(sessions: Session[]) {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))
}

export function byDateAsc(sessions: Session[]) {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date))
}

// L'ultima volta che hai fatto un esercizio (compreso il punto di partenza dalle note)
export function lastLog(
  sessions: Session[],
  exId: string,
): { session: Session; log: LoggedExercise } | null {
  for (const session of byDateDesc(sessions)) {
    const log = session.exercises.find((e) => e.exId === exId)
    if (log && log.sets.length > 0) return { session, log }
  }
  return null
}

// Serie precompilate con i valori dell'ultima volta
export function prefillSets(ex: Exercise, sessions: Session[]): DraftSet[] {
  const last = lastLog(sessions, ex.id)
  const n = partCount(ex)
  return Array.from({ length: Math.max(1, ex.sets) }, (_, i) => {
    const src = last ? (last.log.sets[i] ?? last.log.sets[last.log.sets.length - 1]) : undefined
    const e = Array.from({ length: n }, (_, p): Entry => ({
      w: src?.[p]?.w ?? null,
      r: src?.[p]?.r ?? null,
    }))
    return { e, done: false }
  })
}

export function createDraft(day: Day, sessions: Session[], now = new Date()): Draft {
  const exercises: Draft['exercises'] = {}
  for (const ex of day.exercises) exercises[ex.id] = { exId: ex.id, sets: prefillSets(ex, sessions) }
  return { dayId: day.id, startedAt: now.toISOString(), exercises }
}

// Allinea un allenamento in corso alla scheda, se nel frattempo e' cambiata
export function syncDraft(day: Day, draft: Draft, sessions: Session[]): Draft {
  const exercises: Draft['exercises'] = {}
  for (const ex of day.exercises) {
    const current = draft.exercises[ex.id]
    if (!current) {
      exercises[ex.id] = { exId: ex.id, sets: prefillSets(ex, sessions) }
      continue
    }
    const n = partCount(ex)
    const sets = current.sets.map((s) =>
      s.e.length === n
        ? s
        : { ...s, e: Array.from({ length: n }, (_, p) => s.e[p] ?? { w: null, r: null }) },
    )
    exercises[ex.id] = { ...current, sets }
  }
  return { ...draft, exercises }
}

export type Suggestion = { step: number; reps: number }

// Doppia progressione: se l'ultima volta hai chiuso l'obiettivo in tutte le serie, sali di peso
export function progressionFor(ex: Exercise, sessions: Session[]): Suggestion | null {
  if (ex.target == null || !(ex.step > 0)) return null
  const last = lastLog(sessions, ex.id)
  if (!last) return null
  const sets = last.log.sets
  if (sets.length < ex.sets) return null
  const target = ex.target
  const ok = sets.every(
    (row) =>
      row.length > 0 &&
      row.every((en) => en.r != null && en.r >= target && en.w != null && en.w > 0),
  )
  return ok ? { step: ex.step, reps: target } : null
}

export function draftProgress(day: Day, draft: Draft | undefined) {
  let total = 0
  let done = 0
  for (const ex of day.exercises) {
    const d = draft?.exercises[ex.id]
    const sets = d ? d.sets : Array.from({ length: ex.sets })
    total += sets.length
    if (d) done += d.sets.filter((s) => s.done).length
  }
  return { total, done }
}

const hasValue = (s: DraftSet) => s.e.some((en) => en.w != null || en.r != null)

export function draftToSession(
  day: Day,
  draft: Draft,
  includeAll: boolean,
  now = new Date(),
): Session {
  const exercises: LoggedExercise[] = []
  for (const ex of day.exercises) {
    const d = draft.exercises[ex.id]
    if (!d) continue
    const sets = d.sets
      .filter((s) => (includeAll ? hasValue(s) : s.done))
      .map((s) => s.e.map((en) => ({ ...en })))
    if (sets.length) exercises.push({ exId: ex.id, name: ex.name, parts: ex.parts, sets })
  }
  const minutes = Math.round((now.getTime() - new Date(draft.startedAt).getTime()) / 60000)
  return {
    id: uid(),
    dayId: day.id,
    dayName: day.name,
    color: day.color,
    date: now.toISOString(),
    // Un allenamento lasciato aperto per ore non ha una durata sensata
    durationMin: minutes > 0 && minutes <= 240 ? minutes : undefined,
    exercises,
  }
}

export function sessionSetCount(s: Session) {
  return s.exercises.reduce((n, ex) => n + ex.sets.length, 0)
}

export function sessionVolume(s: Session) {
  let v = 0
  for (const ex of s.exercises)
    for (const row of ex.sets) for (const en of row) v += (en.w ?? 0) * (en.r ?? 0)
  return v
}

export type RecordHit = { name: string; part?: string; w: number; prev: number }

// Nuovi massimali di peso rispetto a tutte le sessioni precedenti
export function newRecords(session: Session, previous: Session[]): RecordHit[] {
  const hits: RecordHit[] = []
  for (const log of session.exercises) {
    const parts = log.parts ? 2 : 1
    for (let p = 0; p < parts; p++) {
      const max = maxWeight(log.sets, p)
      if (max == null) continue
      let prev: number | null = null
      for (const s of previous) {
        const old = s.exercises.find((e) => e.exId === log.exId)
        const m = old ? maxWeight(old.sets, p) : null
        if (m != null && (prev == null || m > prev)) prev = m
      }
      if (prev != null && max > prev)
        hits.push({ name: log.name, part: log.parts?.[p], w: max, prev })
    }
  }
  return hits
}

function maxWeight(sets: Entry[][], part: number): number | null {
  let max: number | null = null
  for (const row of sets) {
    const w = row[part]?.w
    if (w != null && (max == null || w > max)) max = w
  }
  return max
}

// Il giorno che tocca oggi: quello dopo l'ultimo allenamento fatto
export function nextDayId(days: Day[], sessions: Session[]): string | undefined {
  const last = byDateDesc(sessions).find(
    (s) => s.source !== 'note' && days.some((d) => d.id === s.dayId),
  )
  if (!last) return days[0]?.id
  const i = days.findIndex((d) => d.id === last.dayId)
  return days[(i + 1) % days.length]?.id
}

export function lastDone(sessions: Session[], dayId: string): Session | undefined {
  return byDateDesc(sessions).find((s) => s.dayId === dayId && s.source !== 'note')
}

export type Metric = 'carico' | 'volume' | 'ripetizioni'
export type Point = { date: string; value: number; sessionId: string; note: boolean }

export function progressSeries(
  sessions: Session[],
  exId: string,
  metric: Metric,
  part = 0,
): Point[] {
  const points: Point[] = []
  for (const s of byDateAsc(sessions)) {
    const log = s.exercises.find((e) => e.exId === exId)
    if (!log) continue
    const entries = log.sets.map((row) => row[part]).filter((en): en is Entry => !!en)
    let value: number | null = null
    if (metric === 'carico') {
      for (const en of entries) if (en.w != null && (value == null || en.w > value)) value = en.w
    } else if (metric === 'volume') {
      const v = entries.reduce((sum, en) => sum + (en.w ?? 0) * (en.r ?? 0), 0)
      value = v > 0 ? v : null
    } else {
      const r = entries.reduce((sum, en) => sum + (en.r ?? 0), 0)
      value = r > 0 ? r : null
    }
    if (value != null)
      points.push({ date: s.date, value, sessionId: s.id, note: s.source === 'note' })
  }
  return points
}

// Controlla un backup importato prima di sostituire i dati
export function normalizeState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<AppState>
  if (o.v !== 1 || !Array.isArray(o.days) || !Array.isArray(o.sessions)) return null
  const daysOk = o.days.every(
    (d) =>
      d &&
      typeof d.id === 'string' &&
      typeof d.name === 'string' &&
      Array.isArray(d.exercises) &&
      d.exercises.every((ex) => ex && typeof ex.id === 'string' && typeof ex.name === 'string'),
  )
  const sessionsOk = o.sessions.every(
    (s) => s && typeof s.id === 'string' && typeof s.date === 'string' && Array.isArray(s.exercises),
  )
  if (!daysOk || !sessionsOk) return null
  return {
    v: 1,
    days: o.days,
    sessions: o.sessions,
    drafts: o.drafts && typeof o.drafts === 'object' ? o.drafts : {},
    lastBackup: typeof o.lastBackup === 'string' ? o.lastBackup : undefined,
    // I dati salvati prima del primo avvio guidato hanno gia' una scheda
    onboarded: typeof o.onboarded === 'boolean' ? o.onboarded : o.days.length > 0,
  }
}
