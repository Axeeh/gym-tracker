import { useRef } from 'react'
import { ChevronRight, ClipboardList, FolderDown, Share, SquarePlus, Wand2 } from 'lucide-react'
import { replaceState, startFromTemplate } from '../store'
import { readBackup } from '../backup'
import { installHint } from '../device'
import { toast } from '../flash'

// Primo avvio: si sceglie da dove partire
export function Welcome() {
  const hint = installHint()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <main className="screen welcome">
      <div className="welcome-art" aria-hidden="true">
        <span data-color="corallo" />
        <span data-color="blu" />
        <span data-color="verde" />
      </div>
      <header className="head">
        <h1>Benvenuto in Scheda</h1>
        <p className="lead">
          Segna pesi e ripetizioni di ogni allenamento e guarda come migliori. I dati restano su questo
          telefono.
        </p>
      </header>

      {hint === 'ios' && (
        <div className="install">
          <p>
            <strong>Prima installala come app.</strong> Tocca <Share size={17} aria-label="Condividi" />{' '}
            e poi «Aggiungi alla schermata Home» <SquarePlus size={17} aria-hidden="true" />. Poi aprila
            dall'icona e scegli da lì: quello che fai qui in Safari non passa all'app.
          </p>
        </div>
      )}
      {hint === 'android' && (
        <div className="install">
          <p>
            <strong>Prima installala come app:</strong> dal menu del browser scegli «Installa app» o
            «Aggiungi a schermata Home», poi aprila dall'icona.
          </p>
        </div>
      )}

      <h2 className="section-title">Da dove parti?</h2>
      <div className="group">
        <button
          type="button"
          className="row choice"
          data-color="corallo"
          onClick={() => {
            startFromTemplate()
            toast('Scheda pronta, buon allenamento')
          }}
        >
          <span className="ex-icon small">
            <ClipboardList size={24} aria-hidden="true" />
          </span>
          <span className="row-main">
            <span className="row-title">Scheda pronta Push, Pull, Legs</span>
            <span className="row-sub">
              3 giorni e 18 esercizi già impostati. I pesi li metti al primo allenamento.
            </span>
          </span>
          <ChevronRight className="row-end" size={20} aria-hidden="true" />
        </button>
        <a className="row choice" data-color="blu" href="#/crea">
          <span className="ex-icon small">
            <Wand2 size={24} aria-hidden="true" />
          </span>
          <span className="row-main">
            <span className="row-title">Crea la tua scheda</span>
            <span className="row-sub">Scegli i giorni e gli esercizi, uno per uno.</span>
          </span>
          <ChevronRight className="row-end" size={20} aria-hidden="true" />
        </a>
        <button type="button" className="row choice" data-color="verde" onClick={() => fileRef.current?.click()}>
          <span className="ex-icon small">
            <FolderDown size={24} aria-hidden="true" />
          </span>
          <span className="row-main">
            <span className="row-title">Ripristina un backup</span>
            <span className="row-sub">Hai già usato Scheda su un altro telefono.</span>
          </span>
          <ChevronRight className="row-end" size={20} aria-hidden="true" />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const next = await readBackup(e.target.files?.[0])
          e.target.value = ''
          if (!next) return toast('Questo file non è un backup di Scheda')
          replaceState(next)
          toast('Backup ripristinato')
        }}
      />
    </main>
  )
}
