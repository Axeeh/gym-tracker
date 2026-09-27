import { useMemo, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import { CATALOG, GROUPS, suggestedGroups, type CatalogItem, type Group } from '../catalog'
import { guessIcon } from '../icons'
import { Pictogram } from '../ui'

export type Custom = { id: string; name: string }

type Filter = 'consigliati' | 'tutti' | Group

const groupLabel = (g: Group) => GROUPS.find((x) => x.key === g)!.label

// Elenco degli esercizi del catalogo da spuntare, con ricerca e filtro per muscolo
export function ExercisePicker({
  dayName,
  picked,
  onToggle,
  present,
  customs,
  onAddCustom,
  onRemoveCustom,
}: {
  dayName: string
  picked: string[]
  onToggle: (id: string) => void
  // Esercizi del catalogo gia' presenti nel giorno
  present?: Set<string>
  customs: Custom[]
  onAddCustom: (name: string) => void
  onRemoveCustom: (id: string) => void
}) {
  const suggested = useMemo(() => suggestedGroups(dayName), [dayName])
  const [filter, setFilter] = useState<Filter>(suggested.length ? 'consigliati' : 'tutti')
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      const hits = CATALOG.filter((c) => c.name.toLowerCase().includes(q))
      return [{ title: hits.length ? 'Risultati' : '', items: hits }]
    }
    const groups: Group[] =
      filter === 'consigliati'
        ? suggested
        : filter === 'tutti'
          ? GROUPS.map((g) => g.key)
          : [filter]
    return groups.map((g) => ({ title: groupLabel(g), items: CATALOG.filter((c) => c.group === g) }))
  }, [query, filter, suggested])

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    onAddCustom(name)
    setCustomName('')
  }

  const row = (item: CatalogItem) => {
    const order = picked.indexOf(item.id)
    const isPresent = present?.has(item.id) ?? false
    return (
      <button
        key={item.id}
        type="button"
        className="row pick-row"
        aria-pressed={order >= 0}
        disabled={isPresent}
        onClick={() => onToggle(item.id)}
      >
        <span className="ex-icon small">
          <Pictogram icon={item.icon} size={30} />
        </span>
        <span className="row-main">
          <span className="row-title">{item.name}</span>
          <span className="row-sub">
            {isPresent ? 'Già nella scheda' : `${groupLabel(item.group)} · ${item.sets} serie`}
          </span>
        </span>
        <span className="pick-mark" aria-hidden="true">
          {order >= 0 ? <span className="num">{order + 1}</span> : isPresent ? <Check size={18} /> : <Plus size={18} />}
        </span>
      </button>
    )
  }

  return (
    <div className="picker">
      <div className="search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          className="text-input"
          placeholder="Cerca un esercizio"
          aria-label="Cerca un esercizio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query.trim() && (
        <div className="chips" role="group" aria-label="Muscoli">
          {suggested.length > 0 && (
            <button type="button" aria-pressed={filter === 'consigliati'} onClick={() => setFilter('consigliati')}>
              Consigliati
            </button>
          )}
          <button type="button" aria-pressed={filter === 'tutti'} onClick={() => setFilter('tutti')}>
            Tutti
          </button>
          {GROUPS.map((g) => (
            <button key={g.key} type="button" aria-pressed={filter === g.key} onClick={() => setFilter(g.key)}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      {sections.map((sec) =>
        sec.items.length ? (
          <section key={sec.title} aria-label={sec.title}>
            <h3 className="month">{sec.title}</h3>
            <div className="group">{sec.items.map(row)}</div>
          </section>
        ) : (
          <p key="none" className="hint">
            Nessun esercizio con questo nome. Puoi crearlo qui sotto.
          </p>
        ),
      )}

      <h3 className="month">I tuoi esercizi</h3>
      <div className="group">
        {customs.map((c) => (
          <div key={c.id} className="row">
            <span className="ex-icon small">
              <Pictogram icon={guessIcon(c.name)} size={30} />
            </span>
            <span className="row-main">
              <span className="row-title">{c.name}</span>
              <span className="row-sub">Creato da te</span>
            </span>
            <button
              type="button"
              className="icon-btn plain"
              aria-label={`Togli ${c.name}`}
              onClick={() => onRemoveCustom(c.id)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        ))}
        <form
          className="row custom-row"
          onSubmit={(e) => {
            e.preventDefault()
            addCustom()
          }}
        >
          <input
            className="text-input"
            placeholder={query.trim() ? query.trim() : 'Nome di un esercizio che non trovi'}
            aria-label="Nome del nuovo esercizio"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={!customName.trim()}>
            Aggiungi
          </button>
        </form>
      </div>
    </div>
  )
}
