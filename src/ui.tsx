import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { ColorKey } from './types'
import { parseNum } from './format'
import { ICONS, type IconKey } from './icons'
import { useToast } from './flash'

// ---------- foglio dal basso, su <dialog> nativo ----------

export function Sheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        // tocco fuori dal foglio = chiudi
        const r = e.currentTarget.getBoundingClientRect()
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        if (!inside) onClose()
      }}
    >
      <div className="sheet-grip" aria-hidden="true" />
      {open && children}
    </dialog>
  )
}

// ---------- campo numerico (peso o ripetizioni) ----------

const toText = (v: number | null) => (v == null ? '' : String(v).replace('.', ','))

export function NumberField({
  value,
  onChange,
  label,
  unit,
  part,
  decimals,
  placeholder,
}: {
  value: number | null
  onChange: (v: number | null) => void
  label: string
  unit?: string
  part?: string
  decimals?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState(toText(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(toText(value))
  }, [value])

  return (
    <label className="field">
      {part && (
        <span className="part" aria-hidden="true">
          {part}
        </span>
      )}
      <input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        enterKeyHint="done"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          focused.current = true
          const input = e.currentTarget
          requestAnimationFrame(() => input.select())
        }}
        onBlur={() => {
          focused.current = false
          setText(toText(value))
        }}
        onChange={(e) => {
          const clean = e.target.value.replace(decimals ? /[^\d.,]/g : /\D/g, '')
          setText(clean)
          onChange(parseNum(clean))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      {unit && (
        <span className="unit" aria-hidden="true">
          {unit}
        </span>
      )}
    </label>
  )
}

// ---------- controllo segmentato ----------

export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode; color?: ColorKey }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          data-color={o.color}
          onClick={() => onChange(o.value)}
        >
          {o.color && <span className="dot" aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- stepper - / + ----------

export function Stepper({
  value,
  onChange,
  min,
  max,
  step,
  label,
  format = String,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  label: string
  format?: (v: number) => string
}) {
  const round = (v: number) => Math.round(v * 100) / 100
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Meno ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, round(value - step)))}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <output className="num" aria-live="polite">
        {format(value)}
      </output>
      <button
        type="button"
        aria-label={`Più ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, round(value + step)))}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

// ---------- toast ----------

export function Toaster() {
  const t = useToast()
  return (
    <div role="status" aria-live="polite">
      {t && (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      )}
    </div>
  )
}

// ---------- pittogramma dell'esercizio ----------

export function Pictogram({ icon, size = 30 }: { icon: IconKey; size?: number }) {
  const def: { d: string; thin?: string; circles?: [number, number, number][] } = ICONS[icon]
  return (
    <svg
      className="picto"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={def.d} />
      {def.thin && <path d={def.thin} strokeWidth={1.7} />}
      {def.circles?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
    </svg>
  )
}
