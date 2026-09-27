// Colori disponibili per i giorni della scheda
export type ColorKey = 'corallo' | 'blu' | 'verde' | 'viola' | 'giallo' | 'rosa'

// Un valore registrato: peso in kg e ripetizioni. null = non indicato
export type Entry = { w: number | null; r: number | null }

export type Exercise = {
  id: string
  name: string
  note?: string
  // Superset: i due esercizi fatti in coppia. Assente = esercizio singolo
  parts?: [string, string]
  // Ripetizioni obiettivo, un numero unico. null = nessun obiettivo (es. max)
  target: number | null
  sets: number
  // Secondi di recupero tra una serie e l'altra
  rest: number
  // Aumento di peso proposto quando chiudi l'obiettivo in tutte le serie
  step: number
  // Corpo libero: il peso, se c'e', e' zavorra aggiunta
  bodyweight?: boolean
  // Chiave in ICONS; assente = indovinata dal nome
  icon?: string
}

export type Day = {
  id: string
  name: string
  color: ColorKey
  exercises: Exercise[]
}

// Una serie salvata: un Entry per parte (1 normale, 2 superset)
export type LoggedExercise = {
  exId: string
  name: string
  parts?: [string, string]
  sets: Entry[][]
}

export type Session = {
  id: string
  dayId: string
  dayName: string
  color: ColorKey
  date: string
  durationMin?: number
  // 'note' = punto di partenza importato dalle note dell'iPhone
  source?: 'note'
  exercises: LoggedExercise[]
}

export type DraftSet = { e: Entry[]; done: boolean }

export type DraftExercise = {
  exId: string
  sets: DraftSet[]
  // kg gia' aggiunti con il suggerimento di progressione, per poterlo annullare
  bumped?: number
}

// Allenamento in corso, salvato a ogni modifica
export type Draft = {
  dayId: string
  startedAt: string
  exercises: Record<string, DraftExercise>
}

export type AppState = {
  v: 1
  days: Day[]
  sessions: Session[]
  drafts: Record<string, Draft>
  lastBackup?: string
  // false finche' non si sceglie da dove partire al primo avvio
  onboarded: boolean
}
