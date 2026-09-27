import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronDown, TrendingUp } from 'lucide-react'
import type { AppState } from '../types'
import { progressSeries, type Metric, type Point } from '../logic'
import { fmtDate, fmtNum, fmtShortDate } from '../format'
import { Pictogram, Seg } from '../ui'
import { iconFor } from '../icons'

const UNIT: Record<Metric, string> = { carico: 'kg', volume: 'kg', ripetizioni: 'rip' }

const METRIC_HINT: Record<Metric, string> = {
  carico: 'Il peso più alto che hai usato in ogni allenamento.',
  volume: 'Peso per ripetizioni, sommato su tutte le serie: cresce anche quando fai più ripetizioni.',
  ripetizioni: 'Le ripetizioni totali di tutte le serie.',
}

// Ricorda la scelta mentre passi da una sezione all'altra
const memory: { dayId?: string; exId?: string; metric?: Metric; part?: number } = {}

export function Progress({ state }: { state: AppState }) {
  const { days, sessions } = state
  const [dayId, setDayId] = useState<string | undefined>(memory.dayId ?? days[0]?.id)
  const day = days.find((d) => d.id === dayId) ?? days[0]
  const [exId, setExId] = useState(memory.exId)
  const ex = day?.exercises.find((e) => e.id === exId) ?? day?.exercises[0]
  const [metricChoice, setMetric] = useState<Metric | undefined>(memory.metric)
  const metric: Metric = metricChoice ?? (ex?.bodyweight ? 'ripetizioni' : 'carico')
  const [partChoice, setPart] = useState(memory.part ?? 0)
  const part = ex?.parts ? partChoice : 0

  Object.assign(memory, { dayId: day?.id, exId: ex?.id, metric: metricChoice, part: partChoice })

  const points = useMemo(
    () => (ex ? progressSeries(sessions, ex.id, metric, part) : []),
    [sessions, ex, metric, part],
  )

  const unit = UNIT[metric]
  const current = points[points.length - 1]
  const first = points[0]
  const best = points.reduce((m, p) => Math.max(m, p.value), 0)
  const delta = current && first ? current.value - first.value : 0

  return (
    <main className="screen" data-color={day?.color}>
      <header className="head">
        <h1>Progressi</h1>
        <p>Come stanno andando i tuoi esercizi</p>
      </header>

      {!day || !ex ? (
        <div className="empty">
          <h2>Niente da mostrare</h2>
          <p>Aggiungi degli esercizi alla scheda per vedere i progressi.</p>
        </div>
      ) : (
        <>
          <div className="controls">
            <Seg
              label="Giorno"
              value={day.id}
              onChange={(v) => {
                setDayId(v)
                setExId(undefined)
                setMetric(undefined)
              }}
              options={days.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
            />
            <div className="select-row">
              <span className="ex-icon">
                <Pictogram icon={iconFor(ex)} size={32} />
              </span>
              <div className="select">
                <label htmlFor="ex-select" className="sr-only">
                  Esercizio
                </label>
                <select
                  id="ex-select"
                  value={ex.id}
                  onChange={(e) => {
                    setExId(e.target.value)
                    setMetric(undefined)
                  }}
                >
                  {day.exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={20} aria-hidden="true" />
              </div>
            </div>
            <Seg
              label="Cosa guardare"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'carico', label: 'Carico' },
                { value: 'volume', label: 'Volume' },
                { value: 'ripetizioni', label: 'Ripetizioni' },
              ]}
            />
            {ex.parts && (
              <Seg
                label="Parte del superset"
                value={String(part)}
                onChange={(v) => setPart(Number(v))}
                options={ex.parts.map((name, i) => ({ value: String(i), label: name }))}
              />
            )}
          </div>
          <p className="hint">{METRIC_HINT[metric]}</p>

          {points.length === 0 ? (
            <div className="empty" style={{ marginTop: 20 }}>
              <TrendingUp size={32} aria-hidden="true" />
              <h2>Ancora nessun dato</h2>
              <p>
                {metric === 'carico'
                  ? 'Segna qualche serie di questo esercizio e il grafico parte da lì.'
                  : 'Servono serie con peso e ripetizioni: arrivano col primo allenamento salvato.'}
              </p>
            </div>
          ) : (
            <>
              <div className="stat-line">
                <span className="stat-now">
                  {fmtNum(current.value)}
                  <small>{unit}</small>
                </span>
                {points.length > 1 && (
                  <span className="stat-delta">
                    {delta === 0
                      ? 'Stabile dall’inizio'
                      : `${delta > 0 ? '+' : '−'}${fmtNum(Math.abs(delta))} ${unit} dall’inizio`}
                  </span>
                )}
              </div>
              <p className="stat-sub">
                Record {fmtNum(best)} {unit} ·{' '}
                {points.length === 1 ? '1 allenamento' : `${points.length} allenamenti`}
              </p>

              {points.length > 1 ? (
                <Chart points={points} unit={unit} metricName={metric} />
              ) : (
                <p className="hint">
                  Il grafico compare dal secondo allenamento con questo esercizio.
                </p>
              )}

              <h2 className="section-title">Allenamento per allenamento</h2>
              <div className="group">
                {[...points].reverse().map((p) => (
                  <div key={p.sessionId} className="row table-row">
                    <span>
                      {fmtDate(p.date)}
                      {p.note && <span className="muted"> · dalle note</span>}
                    </span>
                    <span className="num">
                      {fmtNum(p.value)} {unit}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}

// Tacche dell'asse Y su numeri tondi
function niceScale(min: number, max: number, count = 4) {
  if (min === max) {
    min -= Math.max(1, Math.abs(min) * 0.1)
    max += Math.max(1, Math.abs(max) * 0.1)
  }
  const pad = (max - min) * 0.15
  const lo0 = Math.max(0, min - pad)
  const hi0 = max + pad
  // Il passo tondo piu' piccolo che sta in "count" intervalli
  const mag = 10 ** Math.floor(Math.log10((hi0 - lo0) / count))
  const step =
    [1, 2, 2.5, 5, 10, 20]
      .map((m) => m * mag)
      .find((s) => Math.ceil(hi0 / s) - Math.floor(lo0 / s) <= count) ?? 20 * mag
  const lo = Math.floor(lo0 / step) * step
  const hi = Math.ceil(hi0 / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return { lo, hi, ticks }
}

function Chart({ points, unit, metricName }: { points: Point[]; unit: string; metricName: Metric }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setActive(null)
  }, [points])

  const H = 210
  const pad = { l: 44, r: 16, t: 12, b: 28 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = H - pad.t - pad.b

  const times = points.map((p) => new Date(p.date).getTime())
  const t0 = times[0]
  const t1 = times[times.length - 1]
  // Se le date coincidono (es. note e primo allenamento lo stesso giorno) si usa l'ordine
  const byIndex = t1 - t0 < 36e5
  const xAt = (i: number) =>
    pad.l + (byIndex ? (iw * i) / (points.length - 1) : (iw * (times[i] - t0)) / (t1 - t0))

  const values = points.map((p) => p.value)
  const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values))
  const yAt = (v: number) => pad.t + ih - ((v - lo) / (hi - lo)) * ih

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join('')
  const area = `${line}L${xAt(points.length - 1).toFixed(1)},${pad.t + ih}L${xAt(0).toFixed(1)},${pad.t + ih}Z`

  const nearest = (clientX: number) => {
    const rect = boxRef.current!.getBoundingClientRect()
    const x = clientX - rect.left
    let best = 0
    for (let i = 1; i < points.length; i++)
      if (Math.abs(xAt(i) - x) < Math.abs(xAt(best) - x)) best = i
    return best
  }

  const onPointer = (e: PointerEvent<HTMLDivElement>) => setActive(nearest(e.clientX))

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const cur = active ?? points.length - 1
    setActive(Math.min(points.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  const last = points.length - 1
  const a = active != null ? points[active] : null
  const first = points[0]
  const lastP = points[last]
  const label = `Grafico ${metricName}: da ${fmtNum(first.value)} a ${fmtNum(lastP.value)} ${unit}, ${points.length} allenamenti. Usa le frecce per leggere i valori.`

  return (
    <div
      ref={boxRef}
      className="chart"
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointer}
      onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons ? onPointer(e) : undefined)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg viewBox={`0 0 ${width} ${H}`} height={H} aria-hidden="true">
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={pad.l} x2={width - pad.r} y1={yAt(t)} y2={yAt(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.l - 8} y={yAt(t) + 4} textAnchor="end">
              {fmtNum(t)}
            </text>
          ))}
          <text x={xAt(0)} y={H - 6} textAnchor="start">
            {fmtShortDate(first.date)}
          </text>
          {fmtShortDate(lastP.date) !== fmtShortDate(first.date) && (
            <text x={xAt(last)} y={H - 6} textAnchor="end">
              {fmtShortDate(lastP.date)}
            </text>
          )}
        </g>
        <path className="area" d={area} />
        <path className="line" d={line} />
        {a && active != null && (
          <line className="cross" x1={xAt(active)} x2={xAt(active)} y1={pad.t} y2={pad.t + ih} />
        )}
        {points.map((p, i) => (
          <circle
            key={p.sessionId}
            className={`pt${p.note ? ' is-note' : ''}`}
            cx={xAt(i)}
            cy={yAt(p.value)}
            r={i === active ? 6 : 4.5}
          />
        ))}
      </svg>
      {a && active != null && (
        <div
          className="tip"
          style={{ left: Math.min(Math.max(xAt(active), 70), width - 70) }}
        >
          <strong>
            {fmtNum(a.value)} {unit}
          </strong>
          <span>
            {fmtDate(a.date)}
            {a.note ? ' · dalle note' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
