import { useSyncExternalStore } from 'react'
import type { AppState, Day, DraftExercise, Exercise, Session } from './types'
import { freshState, templateState } from './seed'
import {
  applyEntry,
  COLORS,
  createDraft,
  draftToSession,
  dropSet,
  newRecords,
  normalizeState,
  syncDraft,
  uid,
  type RecordHit,
} from './logic'

const KEY = 'scheda.v1'

let state: AppState = load()
let saveFailed = false
const listeners = new Set<() => void>()

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = normalizeState(JSON.parse(raw))
      if (parsed) return parsed
    }
  } catch {
    // dati illeggibili: si riparte dalla scheda iniziale
  }
  return freshState()
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    saveFailed = false
  } catch {
    saveFailed = true
  }
}

function emit() {
  for (const l of listeners) l()
}

function set(fn: (s: AppState) => AppState) {
  state = fn(state)
  persist()
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Se l'app e' aperta in due schede, restano allineate
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    try {
      const parsed = normalizeState(JSON.parse(e.newValue))
      if (parsed) {
        state = parsed
        emit()
      }
    } catch {
      // ignorato
    }
  })
}

export const getState = () => state
export const didSaveFail = () => saveFailed
export const useAppState = () => useSyncExternalStore(subscribe, getState)

// ---------- helper interni ----------

const findDay = (s: AppState, dayId: string) => s.days.find((d) => d.id === dayId)

function mapDay(s: AppState, dayId: string, fn: (d: Day) => Day): AppState {
  return { ...s, days: s.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

function mapDraftExercise(
  s: AppState,
  dayId: string,
  exId: string,
  fn: (d: DraftExercise) => DraftExercise,
): AppState {
  const draft = s.drafts[dayId]
  const ex = draft?.exercises[exId]
  if (!draft || !ex) return s
  return {
    ...s,
    drafts: { ...s.drafts, [dayId]: { ...draft, exercises: { ...draft.exercises, [exId]: fn(ex) } } },
  }
}

// ---------- allenamento in corso ----------

export function openDraft(dayId: string) {
  set((s) => {
    const day = findDay(s, dayId)
    if (!day) return s
    const current = s.drafts[dayId]
    const draft = current ? syncDraft(day, current, s.sessions) : createDraft(day, s.sessions)
    return { ...s, drafts: { ...s.drafts, [dayId]: draft } }
  })
}

export function setEntry(
  dayId: string,
  exId: string,
  setIdx: number,
  part: number,
  field: 'w' | 'r',
  value: number | null,
) {
  set((s) =>
    mapDraftExercise(s, dayId, exId, (d) => ({
      ...d,
      sets: applyEntry(d.sets, setIdx, part, field, value),
    })),
  )
}

// Segna una serie come fatta. Se le ripetizioni sono vuote, vale l'obiettivo
export function toggleDone(dayId: string, exId: string, setIdx: number): boolean {
  let nowDone = false
  set((s) => {
    const ex = findDay(s, dayId)?.exercises.find((e) => e.id === exId)
    return mapDraftExercise(s, dayId, exId, (d) => ({
      ...d,
      sets: d.sets.map((row, i) => {
        if (i !== setIdx) return row
        nowDone = !row.done
        const e =
          nowDone && ex?.target != null
            ? row.e.map((en) => (en.r == null ? { ...en, r: ex.target } : en))
            : row.e
        return { e, done: nowDone }
      }),
    }))
  })
  return nowDone
}

export function addSet(dayId: string, exId: string) {
  set((s) =>
    mapDraftExercise(s, dayId, exId, (d) => {
      const last = d.sets[d.sets.length - 1]
      const e = last ? last.e.map((en) => ({ ...en })) : [{ w: null, r: null }]
      return { ...d, sets: [...d.sets, { e, done: false }] }
    }),
  )
}

export function removeSet(dayId: string, exId: string) {
  set((s) => mapDraftExercise(s, dayId, exId, (d) => ({ ...d, sets: dropSet(d.sets) })))
}

// Aggiunge (o toglie, con delta negativo) peso a tutte le serie non ancora fatte
export function bumpWeights(dayId: string, exId: string, delta: number) {
  set((s) =>
    mapDraftExercise(s, dayId, exId, (d) => ({
      ...d,
      bumped: Math.round(((d.bumped ?? 0) + delta) * 100) / 100 || undefined,
      sets: d.sets.map((row) =>
        row.done
          ? row
          : {
              ...row,
              e: row.e.map((en) =>
                en.w == null ? en : { ...en, w: Math.max(0, Math.round((en.w + delta) * 100) / 100) },
              ),
            },
      ),
    })),
  )
}

export function discardDraft(dayId: string) {
  set((s) => {
    const drafts = { ...s.drafts }
    delete drafts[dayId]
    return { ...s, drafts }
  })
}

export function finishDraft(
  dayId: string,
  includeAll: boolean,
): { session: Session; records: RecordHit[] } | null {
  const s = state
  const day = findDay(s, dayId)
  const draft = s.drafts[dayId]
  if (!day || !draft) return null
  const session = draftToSession(day, draft, includeAll)
  const records = newRecords(session, s.sessions)
  set((cur) => {
    const drafts = { ...cur.drafts }
    delete drafts[dayId]
    return { ...cur, drafts, sessions: [...cur.sessions, session] }
  })
  return { session, records }
}

// ---------- scheda ----------

export function updateDay(dayId: string, patch: Partial<Pick<Day, 'name' | 'color'>>) {
  set((s) => mapDay(s, dayId, (d) => ({ ...d, ...patch })))
}

export function addDay(): string {
  const id = uid()
  set((s) => {
    const used = new Set(s.days.map((d) => d.color))
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[s.days.length % COLORS.length]
    return {
      ...s,
      days: [...s.days, { id, name: `Giorno ${s.days.length + 1}`, color, exercises: [] }],
    }
  })
  return id
}

export function deleteDay(dayId: string) {
  set((s) => {
    const drafts = { ...s.drafts }
    delete drafts[dayId]
    return { ...s, drafts, days: s.days.filter((d) => d.id !== dayId) }
  })
}

export function updateExercise(dayId: string, exId: string, patch: Partial<Exercise>) {
  set((s) =>
    mapDay(s, dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((ex) => (ex.id === exId ? { ...ex, ...patch } : ex)),
    })),
  )
}

export function addExercises(dayId: string, exercises: Exercise[]) {
  set((s) => mapDay(s, dayId, (d) => ({ ...d, exercises: [...d.exercises, ...exercises] })))
}

export function deleteExercise(dayId: string, exId: string) {
  set((s) =>
    mapDay(s, dayId, (d) => ({ ...d, exercises: d.exercises.filter((ex) => ex.id !== exId) })),
  )
}

export function moveExercise(dayId: string, exId: string, dir: -1 | 1) {
  set((s) =>
    mapDay(s, dayId, (d) => {
      const i = d.exercises.findIndex((ex) => ex.id === exId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.exercises.length) return d
      const exercises = [...d.exercises]
      ;[exercises[i], exercises[j]] = [exercises[j], exercises[i]]
      return { ...d, exercises }
    }),
  )
}

// ---------- storico e backup ----------

export function deleteSession(id: string) {
  set((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }))
}

export function markBackup() {
  set((s) => ({ ...s, lastBackup: new Date().toISOString() }))
}

export function replaceState(next: AppState) {
  set(() => ({ ...next, onboarded: true }))
}

// ---------- primo avvio e nuova scheda ----------

export function startFromTemplate() {
  set((s) => ({ ...templateState(), sessions: s.sessions }))
}

// Sostituisce i giorni della scheda. Lo storico resta; gli allenamenti in corso no
export function replacePlan(days: Day[]) {
  set((s) => ({ ...s, days, drafts: {}, onboarded: true }))
}

