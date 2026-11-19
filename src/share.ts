import type { AppState, Day, Exercise } from './types'
import { COLORS, uid } from './logic'
import { ICONS, type IconKey } from './icons'

// Condivisione della scheda tramite link: codifica solo giorni ed esercizi (mai pesi o storico).
// Formato compatto v1:
//   [1, [ [dayName, colorIndex, [ [exName, sets, target, rest, step, opt?], ... ], dayId?], ... ]]
// opt (solo i campi presenti): { i?: exId, n?: note, p?: [a, b], b?: 1, k?: icon }
// Token: 'z' + base64url(deflate-raw(utf8(json))) oppure 'u' + base64url(utf8(json))

const MAX_TOKEN_LEN = 32_000
const MAX_DAYS = 14
const MAX_EXERCISES_PER_DAY = 60

type WireOpt = {
  i?: string
  n?: string
  p?: [string, string]
  b?: 1
  k?: string
}

type WireEx = [string, number, number | null, number, number, WireOpt?]
type WireDay = [string, number, WireEx[], string?]
type WirePayload = [1, WireDay[]]

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): Uint8Array | null {
  if (!str || !/^[A-Za-z0-9_-]+$/.test(str)) return null
  const pad = (4 - (str.length % 4)) % 4
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

function uniqueId(base: string, used: Set<string>): string {
  const clean = base.trim() || uid()
  let id = clean
  for (let n = 2; used.has(id); n++) id = `${clean}-${n}`
  used.add(id)
  return id
}

function toWire(days: Day[]): WirePayload {
  const wireDays: WireDay[] = days.slice(0, MAX_DAYS).map((day) => {
    const colorIdx = Math.max(0, COLORS.indexOf(day.color))
    const wireEx: WireEx[] = day.exercises.slice(0, MAX_EXERCISES_PER_DAY).map((ex) => {
      const opt: WireOpt = {}
      if (ex.id && ex.id !== slugify(ex.name)) opt.i = ex.id
      if (ex.note?.trim()) opt.n = ex.note.trim()
      if (ex.parts) opt.p = [ex.parts[0], ex.parts[1]]
      if (ex.bodyweight) opt.b = 1
      if (ex.icon && ex.icon in ICONS) opt.k = ex.icon
      return Object.keys(opt).length > 0
        ? [ex.name, ex.sets, ex.target, ex.rest, ex.step, opt]
        : [ex.name, ex.sets, ex.target, ex.rest, ex.step]
    })
    return day.id && day.id !== slugify(day.name)
      ? [day.name, colorIdx, wireEx, day.id]
      : [day.name, colorIdx, wireEx]
  })
  return [1, wireDays]
}

function fromWire(raw: unknown): Day[] | null {
  if (!Array.isArray(raw) || raw[0] !== 1 || !Array.isArray(raw[1])) return null
  const rawDays = raw[1]
  if (rawDays.length === 0 || rawDays.length > MAX_DAYS) return null

  const usedDayIds = new Set<string>()
  const usedExIds = new Set<string>()
  const days: Day[] = []

  for (let di = 0; di < rawDays.length; di++) {
    const d = rawDays[di]
    if (!Array.isArray(d) || typeof d[0] !== 'string' || !d[0].trim() || !Array.isArray(d[2])) {
      return null
    }
    if (d[2].length > MAX_EXERCISES_PER_DAY) return null

    const name = d[0].trim().slice(0, 40)
    const colorIdx = typeof d[1] === 'number' && Number.isInteger(d[1]) ? d[1] : -1
    const color = colorIdx >= 0 && colorIdx < COLORS.length ? COLORS[colorIdx] : COLORS[di % COLORS.length]
    const rawDayId = typeof d[3] === 'string' && d[3].trim() ? d[3].trim().slice(0, 60) : slugify(name)
    const id = uniqueId(rawDayId, usedDayIds)

    const exercises: Exercise[] = []
    for (const e of d[2]) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !e[0].trim()) return null
      const exName = e[0].trim().slice(0, 80)
      const sets = clampInt(e[1], 1, 20, 3)
      const target =
        e[2] === null
          ? null
          : typeof e[2] === 'number' && Number.isFinite(e[2]) && e[2] > 0
            ? Math.min(200, Math.round(e[2]))
            : null
      const rest = clampInt(e[3], 0, 3600, 90)
      const step =
        typeof e[4] === 'number' && Number.isFinite(e[4]) && e[4] >= 0
          ? Math.min(100, Math.round(e[4] * 100) / 100)
          : 2.5
      const opt = e[5] && typeof e[5] === 'object' ? (e[5] as WireOpt) : undefined
      const rawExId =
        typeof opt?.i === 'string' && opt.i.trim() ? opt.i.trim().slice(0, 60) : slugify(exName)
      const exId = uniqueId(rawExId, usedExIds)

      const ex: Exercise = { id: exId, name: exName, target, sets, rest, step }
      if (typeof opt?.n === 'string' && opt.n.trim()) ex.note = opt.n.trim().slice(0, 160)
      if (
        Array.isArray(opt?.p) &&
        opt.p.length === 2 &&
        typeof opt.p[0] === 'string' &&
        typeof opt.p[1] === 'string'
      ) {
        ex.parts = [
          opt.p[0].trim().slice(0, 60) || 'Esercizio A',
          opt.p[1].trim().slice(0, 60) || 'Esercizio B',
        ]
      }
      if (opt?.b === 1) ex.bodyweight = true
      if (typeof opt?.k === 'string' && opt.k in ICONS) ex.icon = opt.k as IconKey
      exercises.push(ex)
    }

    days.push({ id, name, color, exercises })
  }

  return days
}

// Codifica una scheda in un token URL-safe. Comprime con deflate-raw quando conviene.
export async function encodePlan(days: Day[], options?: { compress?: boolean }): Promise<string> {
  const bytes = encoder.encode(JSON.stringify(toWire(days)))
  if (options?.compress !== false) {
    const zipped = await deflateRaw(bytes)
    if (zipped && zipped.length < bytes.length) return `z${toBase64Url(zipped)}`
  }
  return `u${toBase64Url(bytes)}`
}

// Decodifica un token in Day[]; null se non valido o danneggiato.
export async function decodePlan(token: string): Promise<Day[] | null> {
  const clean = token.trim()
  if (clean.length < 2 || clean.length > MAX_TOKEN_LEN) return null
  const mode = clean[0]
  const rawBytes = fromBase64Url(clean.slice(1))
  if (!rawBytes) return null

  let jsonBytes: Uint8Array | null
  if (mode === 'z') jsonBytes = await inflateRaw(rawBytes)
  else if (mode === 'u') jsonBytes = rawBytes
  else return null

  if (!jsonBytes) return null
  try {
    return fromWire(JSON.parse(decoder.decode(jsonBytes)))
  } catch {
    return null
  }
}

export function buildShareUrl(token: string, loc: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${loc.origin}${loc.pathname}#/importa/${token}`
}

function safeDecodeUri(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// Legge il token di condivisione sia dall'hash (#/importa/<token>) sia dalla query (?scheda=<token>)
export function extractShareToken(loc: Pick<Location, 'hash' | 'search'>): string | null {
  const hashParts = loc.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (hashParts[0] === 'importa') return hashParts[1] ? safeDecodeUri(hashParts[1]) : ''
  const params = new URLSearchParams(loc.search)
  const fromQuery = params.get('scheda') ?? params.get('importa')
  return fromQuery != null ? fromQuery.trim() : null
}

// Collega la scheda importata allo storico gia' presente sul telefono:
// se un giorno o un esercizio esisteva gia' con lo stesso nome, riusa il suo id quando non collide.
export function linkImportedPlan(imported: Day[], current: AppState): Day[] {
  const sessionDayIds = new Set(current.sessions.map((s) => s.dayId))
  const sessionExIds = new Set(current.sessions.flatMap((s) => s.exercises.map((e) => e.exId)))
  const currentExercises = current.days.flatMap((d) => d.exercises)

  const usedDayIds = new Set<string>()
  const usedExIds = new Set<string>()

  return imported.map((day) => {
    let dayId = day.id
    if (!sessionDayIds.has(dayId)) {
      const norm = day.name.trim().toLowerCase()
      const match = current.days.find(
        (d) => d.name.trim().toLowerCase() === norm && !usedDayIds.has(d.id),
      )
      if (match && sessionDayIds.has(match.id)) dayId = match.id
    }
    dayId = uniqueId(dayId, usedDayIds)

    const exercises = day.exercises.map((ex) => {
      let exId = ex.id
      if (!sessionExIds.has(exId)) {
        const norm = ex.name.trim().toLowerCase()
        const match = currentExercises.find(
          (e) => e.name.trim().toLowerCase() === norm && sessionExIds.has(e.id) && !usedExIds.has(e.id),
        )
        if (match) exId = match.id
      }
      exId = uniqueId(exId, usedExIds)
      return { ...ex, id: exId }
    })

    return { ...day, id: dayId, exercises }
  })
}

export function plansEqual(a: Day[], b: Day[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const da = a[i]
    const db = b[i]
    if (da.name !== db.name || da.color !== db.color || da.exercises.length !== db.exercises.length) {
      return false
    }
    for (let j = 0; j < da.exercises.length; j++) {
      const ea = da.exercises[j]
      const eb = db.exercises[j]
      if (
        ea.name !== eb.name ||
        ea.sets !== eb.sets ||
        ea.target !== eb.target ||
        ea.rest !== eb.rest ||
        ea.step !== eb.step ||
        (ea.note ?? '') !== (eb.note ?? '') ||
        Boolean(ea.bodyweight) !== Boolean(eb.bodyweight) ||
        (ea.icon ?? '') !== (eb.icon ?? '') ||
        (ea.parts?.[0] ?? '') !== (eb.parts?.[0] ?? '') ||
        (ea.parts?.[1] ?? '') !== (eb.parts?.[1] ?? '')
      ) {
        return false
      }
    }
  }
  return true
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback sotto
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export async function nativeShareUrl(url: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported'
  try {
    await navigator.share({ title: 'Scheda di allenamento', url })
    return 'shared'
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}
