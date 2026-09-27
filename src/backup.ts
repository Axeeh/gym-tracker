import type { AppState } from './types'
import { normalizeState } from './logic'
import { getState, markBackup } from './store'
import { toast } from './flash'

// Esporta tutti i dati in un file JSON: condivisione su iPhone, download altrove
export async function exportBackup() {
  const data = JSON.stringify(getState(), null, 2)
  const name = `scheda-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([data], name, { type: 'application/json' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup Scheda' })
      markBackup()
      toast('Backup pronto')
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
  markBackup()
  toast('Backup scaricato')
}

// Legge un file di backup; null se non e' un backup di Scheda
export async function readBackup(file: File | undefined): Promise<AppState | null> {
  if (!file) return null
  try {
    return normalizeState(JSON.parse(await file.text()))
  } catch {
    return null
  }
}

export const realCount = (s: AppState) => s.sessions.filter((x) => x.source !== 'note').length
