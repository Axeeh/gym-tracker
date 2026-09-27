import { useEffect, useState } from 'react'

// ---------- percorsi (hash, cosi' funziona su qualsiasi hosting statico) ----------

export type Route =
  | { name: 'home' }
  | { name: 'workout'; dayId: string }
  | { name: 'progress' }
  | { name: 'history' }
  | { name: 'plan' }
  | { name: 'builder' }
  | { name: 'add'; dayId: string }

export function parseHash(hash: string): Route {
  const [first, second, third] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (first === 'allenamento' && second) return { name: 'workout', dayId: decodeURIComponent(second) }
  if (first === 'progressi') return { name: 'progress' }
  if (first === 'storico') return { name: 'history' }
  if (first === 'scheda' && second === 'aggiungi' && third)
    return { name: 'add', dayId: decodeURIComponent(third) }
  if (first === 'scheda') return { name: 'plan' }
  if (first === 'crea') return { name: 'builder' }
  return { name: 'home' }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// Scelte da ricordare tra una schermata e l'altra
export const selection: { planDayId?: string } = {}

export const go = (path: string) => {
  location.hash = path
}

// ---------- schermo sempre acceso durante l'allenamento ----------

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // non disponibile (es. batteria scarica): pazienza
      }
    }
    const onVisible = () => {
      if (!stopped && document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active])
}

// ---------- installazione ----------

// Su quale telefono spiegare come aggiungere l'app alla schermata Home (null se gia' installata)
export function installHint(): 'ios' | 'android' | null {
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return null
  const ua = navigator.userAgent
  // iPad recenti si presentano come Mac, ma con il touch
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}
