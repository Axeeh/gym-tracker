import type { Day, Entry, Session } from './types'
import { lastLog } from './logic'

export const fmtNum = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 })

export const fmtKg = (n: number) => `${fmtNum(n)} kg`

// "1 esercizio", "3 esercizi"
export const nEx = (n: number) => (n === 1 ? '1 esercizio' : `${n} esercizi`)

// Accetta sia "47,5" sia "47.5"; vuoto = null
export function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export function daysAgo(iso: string, now = new Date()) {
  return Math.round((dayStart(now) - dayStart(new Date(iso))) / 86400000)
}

export function relDay(iso: string, now = new Date()) {
  const n = daysAgo(iso, now)
  if (n <= 0) return 'oggi'
  if (n === 1) return 'ieri'
  if (n < 7) return `${n} giorni fa`
  const w = Math.floor(n / 7)
  if (n < 31) return w === 1 ? '1 settimana fa' : `${w} settimane fa`
  const m = Math.floor(n / 30)
  return m === 1 ? '1 mese fa' : `${m} mesi fa`
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

export const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })

export const fmtLongDate = (d: Date) =>
  d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

export function fmtMonth(iso: string) {
  const s = new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

function fmtOne(en: Entry | undefined) {
  if (!en) return '–'
  if (en.w != null && en.r != null) return `${fmtNum(en.w)}×${en.r}`
  if (en.w != null) return `${fmtNum(en.w)} kg`
  if (en.r != null) return `${en.r} rip`
  return '–'
}

// Una serie: "45×8", nei superset "27 kg + 14 kg"
export const fmtSet = (row: Entry[]) => row.map(fmtOne).join(' + ')

export const fmtSets = (sets: Entry[][]) => sets.map(fmtSet).join('  ·  ')

// La scheda nel formato delle note dell'iPhone, con gli ultimi valori
export function planAsText(days: Day[], sessions: Session[]) {
  return days
    .map((day, i) => {
      const lines = day.exercises.map((ex) => {
        const last = lastLog(sessions, ex.id)
        const sets = last
          ? last.log.sets.map((row) => {
              const w = row
                .map((en) => (en.w != null ? `${fmtNum(en.w)}kg` : ''))
                .filter(Boolean)
                .join(' - ')
              const r = row.map((en) => en.r).find((r) => r != null)
              return [w, r != null ? String(r) : ex.bodyweight ? 'max' : ''].filter(Boolean).join(' ')
            })
          : []
        return [ex.name, ...sets].join(' ').trim()
      })
      return [`Giorno ${i + 1}, ${day.name}`, ...lines].join('\n')
    })
    .join('\n\n')
}
