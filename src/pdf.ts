import type { ColorKey, Day, Entry, LoggedExercise, Session } from './types'
import {
  newRecords,
  progressSeries,
  sessionSetCount,
  sessionVolume,
  type Metric,
  type Point,
  type RecordHit,
} from './logic'
import { fmtKg, fmtNum, fmtShortDate, fmtTime } from './format'
import { toast } from './flash'

export type WorkoutPdfOptions = {
  color?: ColorKey
  days?: Day[]
  sessions?: Session[]
  records?: RecordHit[]
}

export type DayProgressPdfOptions = {
  metric?: Metric
  now?: Date
}

// ============================================================================
// Costanti di pagina (A4 in punti tipografici) e palette per stampa
// ============================================================================

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN_X = 34
const MARGIN_TOP = 32
const FOOTER_Y = PAGE_H - 24
const BODY_BOTTOM = PAGE_H - 40
const CONTENT_W = PAGE_W - MARGIN_X * 2
const COL_GAP = 12
const COL_W = (CONTENT_W - COL_GAP) / 2
const ROW_GAP = 9

type Rgb = readonly [number, number, number]

const INK: Rgb = [0.094, 0.102, 0.122] // #181A1F
const INK_2: Rgb = [0.322, 0.341, 0.388] // #525763
const INK_3: Rgb = [0.486, 0.51, 0.565] // #7C8290
const LINE: Rgb = [0.898, 0.906, 0.925] // #E5E7EC
const ROW_LINE: Rgb = [0.929, 0.937, 0.953] // #EDEFF3
const SURFACE: Rgb = [0.969, 0.973, 0.98] // #F7F8FA
const CARD_HEAD: Rgb = [0.98, 0.982, 0.988] // #FAFBFC
const WHITE: Rgb = [1, 1, 1]

const DAY_PALETTE: Record<ColorKey, { accent: Rgb; soft: Rgb }> = {
  corallo: { accent: [0.851, 0.408, 0.22], soft: [0.988, 0.945, 0.925] },
  blu: { accent: [0.231, 0.455, 0.839], soft: [0.933, 0.953, 0.988] },
  verde: { accent: [0.18, 0.588, 0.388], soft: [0.929, 0.969, 0.949] },
  viola: { accent: [0.541, 0.345, 0.8], soft: [0.957, 0.937, 0.984] },
  giallo: { accent: [0.722, 0.541, 0.102], soft: [0.984, 0.965, 0.91] },
  rosa: { accent: [0.831, 0.302, 0.451], soft: [0.988, 0.937, 0.953] },
}

// ============================================================================
// Codifica WinAnsi (Windows-1252) e larghezze approssimate per Helvetica
// ============================================================================

const WIN_ANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, // €
  0x2026: 0x85, // …
  0x2039: 0x8b, // ‹
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x2122: 0x99, // ™
  0x203a: 0x9b, // ›
}

// Mappa un testo Unicode nei byte WinAnsi validi (sostituendo spazi speciali e caratteri non supportati)
function toWinAnsiBytes(input: string): number[] {
  const bytes: number[] = []
  const normalized = input.replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
  for (const ch of normalized) {
    const cp = ch.codePointAt(0)!
    if (cp >= 0x20 && cp <= 0x7e) {
      bytes.push(cp)
    } else if (cp >= 0xa0 && cp <= 0xff) {
      bytes.push(cp)
    } else if (cp in WIN_ANSI_EXTRA) {
      bytes.push(WIN_ANSI_EXTRA[cp])
    } else if (cp === 0x09) {
      bytes.push(0x20)
    } else {
      const fallback = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      for (const fch of fallback) {
        const fcp = fch.codePointAt(0)!
        if (fcp >= 0x20 && fcp <= 0x7e) bytes.push(fcp)
      }
    }
  }
  return bytes
}

// Formatta una stringa PDF in puro ASCII a 7 bit (ottale \ddd per i byte >= 128)
// cosi' la lunghezza in caratteri coincide sempre con la lunghezza in byte nella tabella xref
function pdfString(text: string): string {
  let out = '('
  for (const b of toWinAnsiBytes(text)) {
    if (b === 0x5c) out += '\\\\'
    else if (b === 0x28) out += '\\('
    else if (b === 0x29) out += '\\)'
    else if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b)
    else out += '\\' + b.toString(8).padStart(3, '0')
  }
  return out + ')'
}

// Stringa UTF-16BE esadecimale (standard PDF per i metadati /Info come /Title)
function pdfUtf16Hex(text: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < text.length; i++) {
    hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')
  }
  return `<${hex}>`
}

// Larghezze AFM in millesimi di em per Helvetica (Regular e Bold)
const NARROW_CHARS = new Set(['i', 'l', 'I', 'j', '!', '.', ',', ':', ';', "'", '|', ' '])
const SEMI_NARROW = new Set(['f', 'r', 't', '(', ')', '[', ']', '-', '/', '·'])
const WIDE_LOWER = new Set(['m', 'w'])
const WIDE_UPPER = new Set([
  'M',
  'W',
  'G',
  'O',
  'Q',
  'D',
  'H',
  'N',
  'U',
  'C',
  'R',
  'A',
  'B',
  'K',
  'P',
  'S',
  'V',
  'X',
  'Y',
])

function charWidthEm(ch: string, bold: boolean): number {
  if (ch >= '0' && ch <= '9') return 0.556
  if (ch === ' ') return 0.278
  if (ch === '–') return 0.556
  if (ch === '—') return 1.0
  if (ch === '×') return 0.584
  if (NARROW_CHARS.has(ch)) return bold ? 0.29 : 0.278
  if (SEMI_NARROW.has(ch)) return bold ? 0.36 : 0.333
  if (WIDE_LOWER.has(ch)) return bold ? 0.85 : 0.78
  if (ch === 'M' || ch === 'W') return bold ? 0.92 : 0.89
  if (WIDE_UPPER.has(ch)) return bold ? 0.74 : 0.7
  if (ch >= 'A' && ch <= 'Z') return bold ? 0.68 : 0.65
  return bold ? 0.58 : 0.54
}

function measureText(text: string, size: number, bold = false): number {
  let w = 0
  const normalized = text.replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
  for (const ch of normalized) w += charWidthEm(ch, bold)
  return w * size
}

function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || measureText(candidate, size, bold) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function truncateText(text: string, maxWidth: number, size: number, bold = false): string {
  if (measureText(text, size, bold) <= maxWidth) return text
  const ell = '…'
  const ellW = measureText(ell, size, bold)
  let out = ''
  for (const ch of text) {
    if (measureText(out + ch, size, bold) + ellW > maxWidth) break
    out += ch
  }
  return out.trimEnd() + ell
}

// ============================================================================
// Piccolo scrittore PDF 1.4 multipagina con coordinate dall'alto
// ============================================================================

const n2 = (v: number) => Number(v.toFixed(2))
const rgb = (c: Rgb) => `${n2(c[0])} ${n2(c[1])} ${n2(c[2])}`

class PdfCanvas {
  private pages: string[][] = []
  private ops: string[] = []

  constructor() {
    this.addPage()
  }

  addPage() {
    this.ops = []
    this.pages.push(this.ops)
  }

  get pageCount() {
    return this.pages.length
  }

  onPage(index: number, fn: () => void) {
    const prev = this.ops
    this.ops = this.pages[index]
    fn()
    this.ops = prev
  }

  private py(y: number) {
    return n2(PAGE_H - y)
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.75) {
    this.ops.push(
      `q ${rgb(color)} RG ${n2(width)} w ${n2(x1)} ${this.py(y1)} m ${n2(x2)} ${this.py(y2)} l S Q`,
    )
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { fill?: Rgb; stroke?: Rgb; lineWidth?: number; radius?: number },
  ) {
    const r = Math.min(opts.radius ?? 0, w / 2, h / 2)
    const parts: string[] = ['q']
    if (opts.fill) parts.push(`${rgb(opts.fill)} rg`)
    if (opts.stroke) parts.push(`${rgb(opts.stroke)} RG ${n2(opts.lineWidth ?? 0.75)} w`)

    if (r <= 0) {
      parts.push(`${n2(x)} ${this.py(y + h)} ${n2(w)} ${n2(h)} re`)
    } else {
      const k = r * 0.55228475
      const x0 = x
      const x1 = x + w
      const top = PAGE_H - y
      const bot = PAGE_H - (y + h)
      parts.push(
        `${n2(x0 + r)} ${n2(top)} m`,
        `${n2(x1 - r)} ${n2(top)} l`,
        `${n2(x1 - r + k)} ${n2(top)} ${n2(x1)} ${n2(top - r + k)} ${n2(x1)} ${n2(top - r)} c`,
        `${n2(x1)} ${n2(bot + r)} l`,
        `${n2(x1)} ${n2(bot + r - k)} ${n2(x1 - r + k)} ${n2(bot)} ${n2(x1 - r)} ${n2(bot)} c`,
        `${n2(x0 + r)} ${n2(bot)} l`,
        `${n2(x0 + r - k)} ${n2(bot)} ${n2(x0)} ${n2(bot + r - k)} ${n2(x0)} ${n2(bot + r)} c`,
        `${n2(x0)} ${n2(top - r)} l`,
        `${n2(x0)} ${n2(top - r + k)} ${n2(x0 + r - k)} ${n2(top)} ${n2(x0 + r)} ${n2(top)} c`,
        'h',
      )
    }

    const op = opts.fill && opts.stroke ? 'B' : opts.fill ? 'f' : 'S'
    parts.push(op, 'Q')
    this.ops.push(parts.join(' '))
  }

  polygon(points: readonly [number, number][], fill: Rgb) {
    if (points.length < 3) return
    const cmds = points.map(([x, y], i) => `${n2(x)} ${this.py(y)} ${i === 0 ? 'm' : 'l'}`)
    this.ops.push(`q ${rgb(fill)} rg ${cmds.join(' ')} h f Q`)
  }

  polyline(points: readonly [number, number][], color: Rgb, width = 1.5) {
    if (points.length < 2) return
    const cmds = points.map(([x, y], i) => `${n2(x)} ${this.py(y)} ${i === 0 ? 'm' : 'l'}`)
    this.ops.push(`q ${rgb(color)} RG ${n2(width)} w 1 J 1 j ${cmds.join(' ')} S Q`)
  }

  circle(
    cx: number,
    cy: number,
    r: number,
    opts: { fill?: Rgb; stroke?: Rgb; lineWidth?: number },
  ) {
    const k = r * 0.55228475
    const y = PAGE_H - cy
    const parts: string[] = ['q']
    if (opts.fill) parts.push(`${rgb(opts.fill)} rg`)
    if (opts.stroke) parts.push(`${rgb(opts.stroke)} RG ${n2(opts.lineWidth ?? 0.9)} w`)
    parts.push(
      `${n2(cx)} ${n2(y + r)} m`,
      `${n2(cx + k)} ${n2(y + r)} ${n2(cx + r)} ${n2(y + k)} ${n2(cx + r)} ${n2(y)} c`,
      `${n2(cx + r)} ${n2(y - k)} ${n2(cx + k)} ${n2(y - r)} ${n2(cx)} ${n2(y - r)} c`,
      `${n2(cx - k)} ${n2(y - r)} ${n2(cx - r)} ${n2(y - k)} ${n2(cx - r)} ${n2(y)} c`,
      `${n2(cx - r)} ${n2(y + k)} ${n2(cx - k)} ${n2(y + r)} ${n2(cx)} ${n2(y + r)} c`,
      'h',
    )
    const op = opts.fill && opts.stroke ? 'B' : opts.fill ? 'f' : 'S'
    parts.push(op, 'Q')
    this.ops.push(parts.join(' '))
  }

  text(
    str: string,
    x: number,
    y: number,
    opts: {
      size: number
      bold?: boolean
      color?: Rgb
      align?: 'left' | 'right' | 'center'
    },
  ) {
    const bold = opts.bold ?? false
    const font = bold ? '/F2' : '/F1'
    let drawX = x
    if (opts.align === 'right') drawX = x - measureText(str, opts.size, bold)
    else if (opts.align === 'center') drawX = x - measureText(str, opts.size, bold) / 2
    const baselineY = PAGE_H - y
    this.ops.push(
      `BT ${font} ${n2(opts.size)} Tf ${rgb(opts.color ?? INK)} rg 1 0 0 1 ${n2(drawX)} ${n2(baselineY)} Tm ${pdfString(str)} Tj ET`,
    )
  }

  build(title: string): Uint8Array<ArrayBuffer> {
    const objects: string[] = []
    const pageObjIds: number[] = []

    // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold
    objects.push('<< /Type /Catalog /Pages 2 0 R >>')
    objects.push('')
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

    for (const ops of this.pages) {
      const pageId = objects.length + 1
      const streamId = pageId + 1
      pageObjIds.push(pageId)
      const stream = ops.join('\n')
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(PAGE_W)} ${n2(PAGE_H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`,
      )
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    }

    objects[1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`

    const infoId = objects.length + 1
    objects.push(`<< /Title ${pdfUtf16Hex(title)} /Creator (Scheda) /Producer (Scheda) >>`)

    let out = '%PDF-1.4\n'
    const offsets: number[] = [0]
    for (let i = 0; i < objects.length; i++) {
      offsets.push(out.length)
      out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
    }

    const xrefOffset = out.length
    out += `xref\n0 ${objects.length + 1}\n`
    out += '0000000000 65535 f \n'
    for (let i = 1; i < offsets.length; i++) {
      out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

    const buf = new ArrayBuffer(out.length)
    const view = new Uint8Array(buf)
    for (let i = 0; i < out.length; i++) view[i] = out.charCodeAt(i) & 0x7f
    return view
  }
}

// ============================================================================
// Formattazione dati dell'allenamento
// ============================================================================

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function fmtFullDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return cap(
    d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  )
}

function localDateStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function slugify(text: string): string {
  const clean = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return clean || 'allenamento'
}

export function workoutPdfFilename(session: Session): string {
  return `allenamento-${slugify(session.dayName)}-${localDateStamp(session.date)}.pdf`
}

function setVolume(row: Entry[]): number {
  let v = 0
  for (const en of row) v += (en.w ?? 0) * (en.r ?? 0)
  return v
}

function exerciseVolume(ex: LoggedExercise): number {
  let v = 0
  for (const row of ex.sets) v += setVolume(row)
  return v
}

function fmtEntryCell(en: Entry | undefined): string {
  if (!en) return '–'
  if (en.w != null && en.r != null) return `${fmtKg(en.w)} × ${en.r}`
  if (en.w != null) return fmtKg(en.w)
  if (en.r != null) return `${en.r} rip`
  return '–'
}

function resolveRecords(session: Session, options?: WorkoutPdfOptions): RecordHit[] {
  if (options?.records) return options.records
  if (session.source === 'note' || !options?.sessions) return []
  const previous = options.sessions.filter(
    (s) => s.id !== session.id && s.date < session.date,
  )
  return newRecords(session, previous)
}

// ============================================================================
// Misurazione e disegno delle schede esercizio (griglia compatta a 2 colonne)
// ============================================================================

const TABLE_HEAD_H = 17
const SET_ROW_H = 16
const CARD_PAD_BOTTOM = 4

type PreparedExercise = {
  idx: number
  ex: LoggedExercise
  summary: string
  isBodyweight: boolean
  nameLines: string[]
  partsLines: string[]
  headH: number
  naturalH: number
}

function prepareExercise(
  ex: LoggedExercise,
  idx: number,
  bwIds: Set<string>,
  cardW: number,
): PreparedExercise {
  const exVol = exerciseVolume(ex)
  const summary = [
    ex.sets.length === 1 ? '1 serie' : `${ex.sets.length} serie`,
    exVol > 0 ? `${fmtNum(Math.round(exVol))} kg` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const isBodyweight = bwIds.has(ex.exId)
  const nameLines = wrapText(ex.name || 'Esercizio', cardW - 42, 9.5, true)
  const partsLines = ex.parts
    ? wrapText(`Superset: A ${ex.parts[0]} + B ${ex.parts[1]}`, cardW - 20, 7.5)
    : []

  const headH =
    9 +
    nameLines.length * 11.5 +
    11.5 + // riga riepilogo serie · volume
    (partsLines.length > 0 ? partsLines.length * 9.5 + 2 : 0) +
    6

  const naturalH = headH + TABLE_HEAD_H + ex.sets.length * SET_ROW_H + CARD_PAD_BOTTOM
  return { idx, ex, summary, isBodyweight, nameLines, partsLines, headH, naturalH }
}

function drawExerciseCard(
  pdf: PdfCanvas,
  item: PreparedExercise,
  x: number,
  cardTop: number,
  cardW: number,
  cardH: number,
  palette: { accent: Rgb; soft: Rgb },
  setSlice: Entry[][],
  startNum: number,
  continued: boolean,
) {
  const { idx, ex, summary, isBodyweight, nameLines, partsLines, headH } = item

  // Contenitore scheda esercizio
  pdf.rect(x, cardTop, cardW, cardH, { fill: WHITE, stroke: LINE, radius: 6.5 })

  // Fascia intestazione (angoli arrotondati solo in alto)
  pdf.rect(x + 0.5, cardTop + 0.5, cardW - 1, headH - 0.5, { fill: CARD_HEAD, radius: 6 })
  pdf.rect(x + 0.5, cardTop + headH - 7, cardW - 1, 7, { fill: CARD_HEAD })
  pdf.line(x, cardTop + headH, x + cardW, cardTop + headH, LINE, 0.65)

  // Badge numerato
  pdf.rect(x + 9, cardTop + 8, 17, 15, { fill: palette.soft, radius: 4 })
  pdf.text(String(idx + 1), x + 17.5, cardTop + 18.2, {
    size: 8,
    bold: true,
    color: palette.accent,
    align: 'center',
  })

  // Nome esercizio
  nameLines.forEach((line, li) => {
    const text = continued && li === nameLines.length - 1 ? `${line} (continua)` : line
    pdf.text(text, x + 32, cardTop + 18.2 + li * 11.5, {
      size: 9.5,
      bold: true,
      color: INK,
    })
  })

  // Sottotitolo compatto: numero serie e volume
  const subY = cardTop + 18.2 + nameLines.length * 11.5
  pdf.text(summary, x + 32, subY, { size: 7.5, color: INK_3 })

  // Eventuale legenda superset
  if (partsLines.length > 0) {
    const py0 = subY + 10.5
    partsLines.forEach((line, li) => {
      pdf.text(line, x + 10, py0 + li * 9.5, { size: 7.5, color: INK_2 })
    })
  }

  // Tabella serie
  const thY = cardTop + headH + 11.5
  const colLeft = x + 10
  const colRight = x + cardW - 10

  if (ex.parts) {
    const colA = x + 29
    const colB = x + 115
    const partLabelW = 80
    pdf.text('#', colLeft, thY, { size: 6.8, bold: true, color: INK_3 })
    pdf.text(truncateText(`A · ${ex.parts[0]}`, partLabelW, 6.8, true).toUpperCase(), colA, thY, {
      size: 6.8,
      bold: true,
      color: INK_3,
    })
    pdf.text(truncateText(`B · ${ex.parts[1]}`, partLabelW, 6.8, true).toUpperCase(), colB, thY, {
      size: 6.8,
      bold: true,
      color: INK_3,
    })
    pdf.text('VOL', colRight, thY, { size: 6.8, bold: true, color: INK_3, align: 'right' })

    setSlice.forEach((row, ri) => {
      const rowTop = cardTop + headH + TABLE_HEAD_H + ri * SET_ROW_H
      pdf.line(x + 9, rowTop, x + cardW - 9, rowTop, ROW_LINE, 0.45)
      const textY = rowTop + 11
      const vol = setVolume(row)
      pdf.text(String(startNum + ri), colLeft, textY, { size: 8, bold: true, color: INK_3 })
      pdf.text(fmtEntryCell(row[0]), colA, textY, { size: 8, color: INK })
      pdf.text(fmtEntryCell(row[1]), colB, textY, { size: 8, color: INK })
      pdf.text(vol > 0 ? fmtKg(Math.round(vol * 100) / 100) : '–', colRight, textY, {
        size: 8,
        color: INK_2,
        align: 'right',
      })
    })
  } else {
    const colWeight = x + 116
    const colReps = x + 172
    pdf.text('SERIE', colLeft, thY, { size: 6.8, bold: true, color: INK_3 })
    pdf.text(isBodyweight ? 'ZAVORRA' : 'PESO', colWeight, thY, {
      size: 6.8,
      bold: true,
      color: INK_3,
      align: 'right',
    })
    pdf.text('RIP', colReps, thY, { size: 6.8, bold: true, color: INK_3, align: 'right' })
    pdf.text('VOLUME', colRight, thY, { size: 6.8, bold: true, color: INK_3, align: 'right' })

    setSlice.forEach((row, ri) => {
      const rowTop = cardTop + headH + TABLE_HEAD_H + ri * SET_ROW_H
      pdf.line(x + 9, rowTop, x + cardW - 9, rowTop, ROW_LINE, 0.45)
      const textY = rowTop + 11
      const en = row[0]
      const vol = setVolume(row)
      pdf.text(String(startNum + ri), colLeft, textY, { size: 8.2, bold: true, color: INK_3 })
      pdf.text(en?.w != null ? fmtKg(en.w) : '–', colWeight, textY, {
        size: 8.2,
        bold: en?.w != null,
        color: INK,
        align: 'right',
      })
      pdf.text(en?.r != null ? String(en.r) : '–', colReps, textY, {
        size: 8.2,
        color: INK,
        align: 'right',
      })
      pdf.text(vol > 0 ? fmtKg(Math.round(vol * 100) / 100) : '–', colRight, textY, {
        size: 8.2,
        color: INK_2,
        align: 'right',
      })
    })
  }
}

// ============================================================================
// Costruzione del PDF dell'allenamento
// ============================================================================

export function buildWorkoutPdf(
  session: Session,
  options?: WorkoutPdfOptions,
): Uint8Array<ArrayBuffer> {
  const liveColor =
    options?.color ??
    options?.days?.find((d) => d.id === session.dayId)?.color ??
    session.color
  const palette = DAY_PALETTE[liveColor] ?? DAY_PALETTE.corallo
  const records = resolveRecords(session, options)

  const bwIds = new Set<string>()
  if (options?.days) {
    for (const day of options.days) {
      for (const ex of day.exercises) {
        if (ex.bodyweight) bwIds.add(ex.id)
      }
    }
  }

  const pdf = new PdfCanvas()
  let y = MARGIN_TOP

  // Barra superiore nel colore del giorno
  pdf.rect(MARGIN_X, y, CONTENT_W, 3.5, { fill: palette.accent, radius: 1.75 })
  y += 16

  // Intestazione compatta: titolo a sinistra, data e ora a destra
  const kicker =
    session.source === 'note' ? 'SCHEDA · PUNTO DI PARTENZA' : 'SCHEDA · ALLENAMENTO'
  pdf.text(kicker, MARGIN_X, y, { size: 7.5, bold: true, color: palette.accent })

  const fullDate = fmtFullDate(session.date)
  const rightMeta =
    session.source === 'note' ? "Pesi importati dalle note dell'iPhone" : `Ore ${fmtTime(session.date)}`
  pdf.text(fullDate, PAGE_W - MARGIN_X, y + 1, { size: 9, bold: true, color: INK, align: 'right' })
  pdf.text(rightMeta, PAGE_W - MARGIN_X, y + 13, {
    size: 8,
    color: INK_3,
    align: 'right',
  })

  const titleMaxW =
    CONTENT_W - Math.max(measureText(fullDate, 9, true), measureText(rightMeta, 8)) - 16
  const titleLines = wrapText(session.dayName || 'Allenamento', Math.max(180, titleMaxW), 19, true)
  y += 19
  for (let i = 0; i < titleLines.length; i++) {
    pdf.text(titleLines[i], MARGIN_X, y + i * 21, { size: 19, bold: true, color: INK })
  }
  y += (titleLines.length - 1) * 21 + 12

  // Riquadro statistiche riepilogative
  const totalSets = sessionSetCount(session)
  const totalVol = sessionVolume(session)
  const stats: { label: string; value: string }[] = [
    { label: 'ESERCIZI', value: String(session.exercises.length) },
    { label: 'SERIE', value: String(totalSets) },
  ]
  if (session.durationMin != null) {
    stats.push({ label: 'DURATA', value: `${session.durationMin} min` })
  }
  if (totalVol > 0) {
    stats.push({ label: 'VOLUME', value: `${fmtNum(Math.round(totalVol))} kg` })
  }

  const statH = 42
  pdf.rect(MARGIN_X, y, CONTENT_W, statH, { fill: SURFACE, stroke: LINE, radius: 7 })
  const statColW = CONTENT_W / stats.length
  stats.forEach((st, i) => {
    const cx = MARGIN_X + i * statColW
    if (i > 0) pdf.line(cx, y + 9, cx, y + statH - 9, LINE, 0.65)
    pdf.text(st.label, cx + 12, y + 15, { size: 7, bold: true, color: INK_3 })
    pdf.text(st.value, cx + 12, y + 32, { size: 13, bold: true, color: INK })
  })
  y += statH + 10

  // Eventuali nuovi record della sessione (a 2 colonne se piu' di uno)
  if (records.length > 0) {
    const recRowH = 14
    const recRows = records.length > 1 ? Math.ceil(records.length / 2) : 1
    const recH = 21 + recRows * recRowH + 5
    pdf.rect(MARGIN_X, y, CONTENT_W, recH, { fill: palette.soft, radius: 7 })
    pdf.rect(MARGIN_X, y, 3, recH, { fill: palette.accent, radius: 1.5 })
    pdf.text('NUOVI RECORD', MARGIN_X + 12, y + 14.5, {
      size: 7.5,
      bold: true,
      color: palette.accent,
    })

    if (records.length === 1) {
      const rec = records[0]
      const ry = y + 28
      pdf.text(truncateText(rec.part ?? rec.name, CONTENT_W - 150, 8.5), MARGIN_X + 12, ry, {
        size: 8.5,
        color: INK,
      })
      pdf.text(`${fmtKg(rec.w)} (era ${fmtNum(rec.prev)})`, PAGE_W - MARGIN_X - 12, ry, {
        size: 8.5,
        bold: true,
        color: INK,
        align: 'right',
      })
    } else {
      const halfW = (CONTENT_W - 24 - COL_GAP) / 2
      records.forEach((rec, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const rx = MARGIN_X + 12 + col * (halfW + COL_GAP)
        const ry = y + 28 + row * recRowH
        const valText = `${fmtKg(rec.w)} (era ${fmtNum(rec.prev)})`
        const valW = measureText(valText, 8, true)
        pdf.text(truncateText(rec.part ?? rec.name, halfW - valW - 8, 8), rx, ry, {
          size: 8,
          color: INK,
        })
        pdf.text(valText, rx + halfW, ry, {
          size: 8,
          bold: true,
          color: INK,
          align: 'right',
        })
      })
    }
    y += recH + 10
  }

  // Elenco esercizi in griglia a 2 colonne
  if (session.exercises.length === 0) {
    pdf.rect(MARGIN_X, y, CONTENT_W, 42, { fill: SURFACE, stroke: LINE, radius: 7 })
    pdf.text('Nessun esercizio registrato in questo allenamento.', MARGIN_X + 14, y + 24, {
      size: 9.5,
      color: INK_2,
    })
  } else {
    const maxPageUsable = BODY_BOTTOM - MARGIN_TOP
    const ensureSpace = (needed: number) => {
      if (y + needed > BODY_BOTTOM && y > MARGIN_TOP + 10) {
        pdf.addPage()
        y = MARGIN_TOP
      }
    }

    const prepared = session.exercises.map((ex, idx) =>
      prepareExercise(ex, idx, bwIds, COL_W),
    )

    // Disegna gli esercizi a coppie (sinistra, destra) in ordine di esecuzione
    let i = 0
    while (i < prepared.length) {
      const left = prepared[i]

      // Caso raro: esercizio singolo piu' alto di una pagina intera -> tutta larghezza con split
      if (left.naturalH > maxPageUsable) {
        const fullItem = prepareExercise(left.ex, left.idx, bwIds, CONTENT_W)
        let offset = 0
        while (offset < fullItem.ex.sets.length) {
          ensureSpace(fullItem.headH + TABLE_HEAD_H + SET_ROW_H + CARD_PAD_BOTTOM)
          const avail = BODY_BOTTOM - y - fullItem.headH - TABLE_HEAD_H - CARD_PAD_BOTTOM
          const count = Math.max(1, Math.floor(avail / SET_ROW_H))
          const slice = fullItem.ex.sets.slice(offset, offset + count)
          const h = fullItem.headH + TABLE_HEAD_H + slice.length * SET_ROW_H + CARD_PAD_BOTTOM
          drawExerciseCard(pdf, fullItem, MARGIN_X, y, CONTENT_W, h, palette, slice, offset + 1, offset > 0)
          y += h + ROW_GAP
          offset += slice.length
        }
        i += 1
        continue
      }

      const right = prepared[i + 1]
      const canPair = !!right && right.naturalH <= maxPageUsable
      const rowH = canPair ? Math.max(left.naturalH, right.naturalH) : left.naturalH

      ensureSpace(rowH)
      drawExerciseCard(pdf, left, MARGIN_X, y, COL_W, rowH, palette, left.ex.sets, 1, false)
      if (canPair) {
        drawExerciseCard(
          pdf,
          right,
          MARGIN_X + COL_W + COL_GAP,
          y,
          COL_W,
          rowH,
          palette,
          right.ex.sets,
          1,
          false,
        )
        i += 2
      } else {
        i += 1
      }
      y += rowH + ROW_GAP
    }
  }

  // Pie' di pagina su tutte le pagine
  const totalPages = pdf.pageCount
  const footerLeft = `Scheda · ${session.dayName} · ${fmtShortDate(session.date)}`
  for (let p = 0; p < totalPages; p++) {
    pdf.onPage(p, () => {
      pdf.line(MARGIN_X, FOOTER_Y - 10, PAGE_W - MARGIN_X, FOOTER_Y - 10, LINE, 0.55)
      pdf.text(footerLeft, MARGIN_X, FOOTER_Y, { size: 7.5, color: INK_3 })
      pdf.text(`Pagina ${p + 1} di ${totalPages}`, PAGE_W - MARGIN_X, FOOTER_Y, {
        size: 7.5,
        color: INK_3,
        align: 'right',
      })
    })
  }

  return pdf.build(`${session.dayName} — Scheda`)
}

// ============================================================================
// Costruzione del PDF dei progressi di un giorno della scheda (2 colonne + grafici)
// ============================================================================

const METRIC_UNIT: Record<Metric, string> = { carico: 'kg', volume: 'kg', ripetizioni: 'rip' }
const METRIC_LABEL: Record<Metric, string> = {
  carico: 'Carico',
  volume: 'Volume',
  ripetizioni: 'Ripetizioni',
}

const POS_INK: Rgb = [0.114, 0.478, 0.31] // #1D7A4F
const POS_BG: Rgb = [0.918, 0.969, 0.941] // #EAF7F0
const NEG_INK: Rgb = [0.722, 0.231, 0.231] // #B83B3B
const NEG_BG: Rgb = [0.992, 0.937, 0.937] // #FDEFEF
const NEUTRAL_BG: Rgb = [0.945, 0.949, 0.965] // #F1F2F6

export function dayProgressPdfFilename(day: Day, now = new Date()): string {
  return `progressi-${slugify(day.name)}-${localDateStamp(now.toISOString())}.pdf`
}

type ProgressCardItem = {
  badge: string
  name: string
  partLabel?: string
  metric: Metric
  unit: string
  points: Point[]
  nameLines: string[]
  headH: number
  naturalH: number
}

function fmtShortDateYear(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function niceChartBounds(values: number[]): { lo: number; hi: number } {
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.12)
    min = Math.max(0, min - pad)
    max = max + pad
  } else {
    const pad = (max - min) * 0.15
    min = Math.max(0, min - pad)
    max = max + pad
  }
  const range = Math.max(1, max - min)
  const mag = 10 ** Math.floor(Math.log10(range / 2))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => range / s <= 4) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  return { lo, hi: hi > lo ? hi : lo + step }
}

function drawProgressCard(
  pdf: PdfCanvas,
  item: ProgressCardItem,
  x: number,
  cardTop: number,
  cardW: number,
  cardH: number,
  palette: { accent: Rgb; soft: Rgb },
) {
  const { badge, partLabel, metric, unit, points, nameLines, headH } = item

  // Contenitore scheda esercizio
  pdf.rect(x, cardTop, cardW, cardH, { fill: WHITE, stroke: LINE, radius: 6.5 })

  // Fascia intestazione (angoli arrotondati solo in alto)
  pdf.rect(x + 0.5, cardTop + 0.5, cardW - 1, headH - 0.5, { fill: CARD_HEAD, radius: 6 })
  pdf.rect(x + 0.5, cardTop + headH - 7, cardW - 1, 7, { fill: CARD_HEAD })
  pdf.line(x, cardTop + headH, x + cardW, cardTop + headH, LINE, 0.65)

  // Badge (es. "1" oppure "3A")
  const badgeW = badge.length > 2 ? 24 : badge.length === 2 ? 21 : 17
  pdf.rect(x + 9, cardTop + 7.5, badgeW, 14.5, { fill: palette.soft, radius: 4 })
  pdf.text(badge, x + 9 + badgeW / 2, cardTop + 17.5, {
    size: 7.5,
    bold: true,
    color: palette.accent,
    align: 'center',
  })

  // Nome esercizio
  const titleX = x + 9 + badgeW + 6
  nameLines.forEach((line, li) => {
    pdf.text(line, titleX, cardTop + 17.5 + li * 11, { size: 9.2, bold: true, color: INK })
  })

  // Sottotitolo: eventuale parte superset + metrica + numero rilevazioni
  const subParts = [
    partLabel ?? null,
    METRIC_LABEL[metric],
    points.length > 0 ? (points.length === 1 ? '1 dato' : `${points.length} dati`) : null,
  ].filter(Boolean)
  const subY = cardTop + 17.5 + nameLines.length * 11
  pdf.text(truncateText(subParts.join(' · '), cardW - (titleX - x) - 10, 7.2), titleX, subY, {
    size: 7.2,
    color: INK_3,
  })

  const bodyTop = cardTop + headH
  const padX = 10

  if (points.length === 0) {
    pdf.text('Nessun dato registrato', x + cardW / 2, bodyTop + (cardH - headH) / 2 + 3, {
      size: 8.2,
      color: INK_3,
      align: 'center',
    })
    return
  }

  const first = points[0]
  const current = points[points.length - 1]
  const best = points.reduce((m, p) => Math.max(m, p.value), 0)
  const delta = Math.round((current.value - first.value) * 100) / 100

  // Riga valore attuale + pillola delta + record a destra
  const statY = bodyTop + 17
  const nowStr = `${fmtNum(current.value)} ${unit}`
  pdf.text(nowStr, x + padX, statY, { size: 12.5, bold: true, color: INK })

  if (points.length >= 2) {
    const deltaText =
      delta === 0
        ? 'Stabile'
        : `${delta > 0 ? '+' : '-'}${fmtNum(Math.abs(delta))} ${unit}`
    const deltaW = measureText(deltaText, 7.2, true) + 9
    const pillX = x + padX + measureText(nowStr, 12.5, true) + 6
    const pillBg = delta > 0 ? POS_BG : delta < 0 ? NEG_BG : NEUTRAL_BG
    const pillInk = delta > 0 ? POS_INK : delta < 0 ? NEG_INK : INK_2
    pdf.rect(pillX, statY - 10, deltaW, 13, { fill: pillBg, radius: 6.5 })
    pdf.text(deltaText, pillX + deltaW / 2, statY - 1, {
      size: 7.2,
      bold: true,
      color: pillInk,
      align: 'center',
    })
  }

  pdf.text(`Record ${fmtNum(best)} ${unit}`, x + cardW - padX, statY - 1, {
    size: 7.4,
    bold: true,
    color: INK_2,
    align: 'right',
  })

  // Area grafico vettoriale
  const chartTop = bodyTop + 26
  const chartBottom = cardTop + cardH - 18
  const chartH = Math.max(36, chartBottom - chartTop)

  if (points.length === 1) {
    pdf.rect(x + padX, chartTop, cardW - padX * 2, chartH, { fill: SURFACE, radius: 5 })
    pdf.text(
      `1 solo dato (${fmtShortDate(first.date)}) · grafico dal 2° allenamento`,
      x + cardW / 2,
      chartTop + chartH / 2 + 2.5,
      { size: 7.4, color: INK_3, align: 'center' },
    )
    return
  }

  const { lo, hi } = niceChartBounds(points.map((p) => p.value))
  const hiLabel = fmtNum(hi)
  const loLabel = fmtNum(lo)
  const axisW = Math.max(measureText(hiLabel, 6.8), measureText(loLabel, 6.8), 16) + 6

  const plotL = x + padX + axisW
  const plotR = x + cardW - padX - 3
  const plotW = Math.max(30, plotR - plotL)
  const plotT = chartTop + 3
  const plotB = chartBottom - 2
  const plotH = Math.max(24, plotB - plotT)

  // Griglia orizzontale (alto, centro, basso)
  const midY = (plotT + plotB) / 2
  pdf.line(plotL, plotT, plotR, plotT, ROW_LINE, 0.5)
  pdf.line(plotL, midY, plotR, midY, ROW_LINE, 0.45)
  pdf.line(plotL, plotB, plotR, plotB, LINE, 0.6)

  // Etichette asse Y
  pdf.text(hiLabel, plotL - 4, plotT + 2.5, { size: 6.8, color: INK_3, align: 'right' })
  pdf.text(loLabel, plotL - 4, plotB + 2, { size: 6.8, color: INK_3, align: 'right' })

  // Coordinate dei punti (per data, oppure per indice se nello stesso giorno)
  const times = points.map((p) => new Date(p.date).getTime())
  const t0 = times[0]
  const t1 = times[times.length - 1]
  const byIndex = t1 - t0 < 36e5

  const coords: [number, number][] = points.map((p, i) => {
    const px =
      plotL + (byIndex ? (plotW * i) / (points.length - 1) : (plotW * (times[i] - t0)) / (t1 - t0))
    const py = plotB - ((p.value - lo) / (hi - lo)) * plotH
    return [px, py]
  })

  // Area sfumata sotto la curva + linea vettoriale
  pdf.polygon([...coords, [coords[coords.length - 1][0], plotB], [coords[0][0], plotB]], palette.soft)
  pdf.polyline(coords, palette.accent, 1.45)

  // Punti: pieni per allenamenti veri, vuoti col bordo per il punto di partenza dalle note
  coords.forEach(([px, py], i) => {
    const isNote = points[i].note
    pdf.circle(px, py, isNote ? 2.3 : 2.5, {
      fill: isNote ? WHITE : palette.accent,
      stroke: isNote ? palette.accent : WHITE,
      lineWidth: isNote ? 1 : 0.8,
    })
  })

  // Asse X: data iniziale, valore iniziale e data finale
  const xLabelY = cardTop + cardH - 6
  const startLabel = fmtShortDate(first.date)
  const endLabel = fmtShortDate(current.date)
  pdf.text(startLabel, plotL, xLabelY, { size: 6.8, color: INK_3 })
  if (endLabel !== startLabel) {
    pdf.text(endLabel, plotR, xLabelY, { size: 6.8, color: INK_3, align: 'right' })
  }
  const midLabel = `Inizio ${fmtNum(first.value)} ${unit}`
  const centerX = (plotL + plotR) / 2
  const availCenter =
    plotW - measureText(startLabel, 6.8) - (endLabel !== startLabel ? measureText(endLabel, 6.8) : 0) - 12
  if (measureText(midLabel, 6.8) <= availCenter) {
    pdf.text(midLabel, centerX, xLabelY, { size: 6.8, color: INK_3, align: 'center' })
  }
}

export function buildDayProgressPdf(
  day: Day,
  sessions: Session[],
  options?: DayProgressPdfOptions,
): Uint8Array<ArrayBuffer> {
  const now = options?.now ?? new Date()
  const palette = DAY_PALETTE[day.color] ?? DAY_PALETTE.corallo
  const realDaySessions = [...sessions]
    .filter((s) => s.dayId === day.id && s.source !== 'note')
    .sort((a, b) => a.date.localeCompare(b.date))

  // Prepara una scheda per ogni esercizio (due schede A/B per i superset)
  const items: ProgressCardItem[] = []
  day.exercises.forEach((ex, idx) => {
    const metric: Metric = options?.metric ?? (ex.bodyweight ? 'ripetizioni' : 'carico')
    const unit = METRIC_UNIT[metric]
    const parts: { badge: string; partIdx: number; partLabel?: string }[] = ex.parts
      ? [
          { badge: `${idx + 1}A`, partIdx: 0, partLabel: `A · ${ex.parts[0]}` },
          { badge: `${idx + 1}B`, partIdx: 1, partLabel: `B · ${ex.parts[1]}` },
        ]
      : [{ badge: String(idx + 1), partIdx: 0 }]

    for (const part of parts) {
      const points = progressSeries(sessions, ex.id, metric, part.partIdx)
      const badgeW = part.badge.length > 2 ? 24 : part.badge.length === 2 ? 21 : 17
      const nameLines = wrapText(ex.name || 'Esercizio', COL_W - (9 + badgeW + 6) - 10, 9.2, true)
      const headH = 8 + nameLines.length * 11 + 10.5 + 5
      const naturalH = headH + 92
      items.push({
        badge: part.badge,
        name: ex.name,
        partLabel: part.partLabel,
        metric,
        unit,
        points,
        nameLines,
        headH,
        naturalH,
      })
    }
  })

  // Statistiche complessive del giorno
  const tracked = items.filter((it) => it.points.length >= 2)
  const improved = tracked.filter(
    (it) => it.points[it.points.length - 1].value > it.points[0].value,
  )
  const allPointDates = items
    .flatMap((it) => it.points.map((p) => p.date))
    .sort((a, b) => a.localeCompare(b))
  const lastDaySession = realDaySessions[realDaySessions.length - 1]

  const pdf = new PdfCanvas()
  let y = MARGIN_TOP

  // Barra superiore nel colore del giorno
  pdf.rect(MARGIN_X, y, CONTENT_W, 3.5, { fill: palette.accent, radius: 1.75 })
  y += 16

  // Intestazione
  const kicker = options?.metric
    ? `SCHEDA · PROGRESSI · ${METRIC_LABEL[options.metric].toUpperCase()}`
    : 'SCHEDA · PROGRESSI'
  pdf.text(kicker, MARGIN_X, y, { size: 7.5, bold: true, color: palette.accent })

  const rightTop = `Aggiornato al ${fmtShortDateYear(now)}`
  const rightSub =
    allPointDates.length >= 2
      ? `Periodo: ${fmtShortDate(allPointDates[0])} – ${fmtShortDate(allPointDates[allPointDates.length - 1])}`
      : realDaySessions.length === 1
        ? '1 allenamento registrato'
        : `${realDaySessions.length} allenamenti registrati`
  pdf.text(rightTop, PAGE_W - MARGIN_X, y + 1, { size: 9, bold: true, color: INK, align: 'right' })
  pdf.text(rightSub, PAGE_W - MARGIN_X, y + 13, { size: 8, color: INK_3, align: 'right' })

  const titleMaxW =
    CONTENT_W - Math.max(measureText(rightTop, 9, true), measureText(rightSub, 8)) - 16
  const titleLines = wrapText(day.name || 'Giorno', Math.max(180, titleMaxW), 19, true)
  y += 19
  for (let i = 0; i < titleLines.length; i++) {
    pdf.text(titleLines[i], MARGIN_X, y + i * 21, { size: 19, bold: true, color: INK })
  }
  y += (titleLines.length - 1) * 21 + 12

  // Riquadro KPI del giorno
  const stats: { label: string; value: string }[] = [
    { label: 'ESERCIZI', value: String(day.exercises.length) },
    { label: 'ALLENAMENTI', value: String(realDaySessions.length) },
    {
      label: 'IN CRESCITA',
      value: tracked.length > 0 ? `${improved.length} su ${tracked.length}` : '–',
    },
    { label: 'ULTIMO', value: lastDaySession ? fmtShortDate(lastDaySession.date) : '–' },
  ]
  const statH = 42
  pdf.rect(MARGIN_X, y, CONTENT_W, statH, { fill: SURFACE, stroke: LINE, radius: 7 })
  const statColW = CONTENT_W / stats.length
  stats.forEach((st, i) => {
    const cx = MARGIN_X + i * statColW
    if (i > 0) pdf.line(cx, y + 9, cx, y + statH - 9, LINE, 0.65)
    pdf.text(st.label, cx + 12, y + 15, { size: 7, bold: true, color: INK_3 })
    pdf.text(st.value, cx + 12, y + 32, { size: 13, bold: true, color: INK })
  })
  y += statH + 11

  // Griglia a 2 colonne di schede progresso
  if (items.length === 0) {
    pdf.rect(MARGIN_X, y, CONTENT_W, 44, { fill: SURFACE, stroke: LINE, radius: 7 })
    pdf.text('Nessun esercizio in questo giorno della scheda.', MARGIN_X + 14, y + 25, {
      size: 9.5,
      color: INK_2,
    })
  } else {
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i]
      const right = items[i + 1]
      const rowH = right ? Math.max(left.naturalH, right.naturalH) : left.naturalH

      if (y + rowH > BODY_BOTTOM && y > MARGIN_TOP + 10) {
        pdf.addPage()
        y = MARGIN_TOP
      }

      drawProgressCard(pdf, left, MARGIN_X, y, COL_W, rowH, palette)
      if (right) {
        drawProgressCard(pdf, right, MARGIN_X + COL_W + COL_GAP, y, COL_W, rowH, palette)
      }
      y += rowH + ROW_GAP
    }
  }

  // Pie' di pagina su tutte le pagine
  const totalPages = pdf.pageCount
  const footerLeft = `Scheda · Progressi ${day.name} · ${fmtShortDate(now.toISOString())}`
  for (let p = 0; p < totalPages; p++) {
    pdf.onPage(p, () => {
      pdf.line(MARGIN_X, FOOTER_Y - 10, PAGE_W - MARGIN_X, FOOTER_Y - 10, LINE, 0.55)
      pdf.text(footerLeft, MARGIN_X, FOOTER_Y, { size: 7.5, color: INK_3 })
      pdf.text(`Pagina ${p + 1} di ${totalPages}`, PAGE_W - MARGIN_X, FOOTER_Y, {
        size: 7.5,
        color: INK_3,
        align: 'right',
      })
    })
  }

  return pdf.build(`Progressi ${day.name} — Scheda`)
}

// ============================================================================
// Condivisione (iPhone/mobile) o download diretto (desktop)
// ============================================================================

async function deliverPdf(bytes: Uint8Array<ArrayBuffer>, name: string, title: string) {
  const file = new File([bytes], name, { type: 'application/pdf' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title })
      toast('PDF pronto')
      return
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  toast('PDF scaricato')
}

export async function exportSessionPdf(session: Session, options?: WorkoutPdfOptions) {
  await deliverPdf(
    buildWorkoutPdf(session, options),
    workoutPdfFilename(session),
    `${session.dayName} — Scheda`,
  )
}

export async function exportDayProgressPdf(
  day: Day,
  sessions: Session[],
  options?: DayProgressPdfOptions,
) {
  await deliverPdf(
    buildDayProgressPdf(day, sessions, options),
    dayProgressPdfFilename(day, options?.now),
    `Progressi ${day.name} — Scheda`,
  )
}
