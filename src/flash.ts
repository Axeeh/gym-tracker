import { useSyncExternalStore } from 'react'
import type { Session } from './types'
import type { RecordHit } from './logic'

// Piccoli store per messaggi temporanei: toast e riepilogo di fine allenamento

function createSignal<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      for (const l of listeners) l()
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

type Toast = { id: number; text: string } | null
const toastSignal = createSignal<Toast>(null)

export function toast(text: string) {
  const id = Date.now()
  toastSignal.set({ id, text })
  setTimeout(() => {
    if (toastSignal.get()?.id === id) toastSignal.set(null)
  }, 2600)
}

export const useToast = () => useSyncExternalStore(toastSignal.subscribe, toastSignal.get)

export type Result = { session: Session; records: RecordHit[] } | null
const resultSignal = createSignal<Result>(null)

export const showResult = (r: Result) => resultSignal.set(r)
export const useResult = () => useSyncExternalStore(resultSignal.subscribe, resultSignal.get)
