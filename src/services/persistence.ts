import { openDB } from 'idb'
import { createDefaultState, type AppState, type Entry } from '../types/app'
import { sortAndCleanEntries } from '../utils/entries'

const DB_NAME = 'mass-app'
const STORE_NAME = 'app-state'
const STORE_KEY = 'root'
const LOCAL_CACHE_KEY = 'mass-app-cache'

type MaybeAppState = AppState | undefined

const normalizeEntry = (entry: Partial<Entry> & Record<string, unknown>): Entry | null => {
  const ts = typeof entry.ts === 'string' ? entry.ts : typeof entry.date === 'string' ? entry.date : null
  const rawKg =
    typeof entry.kg === 'number'
      ? entry.kg
      : typeof entry.kg === 'string'
        ? Number.parseFloat(entry.kg)
        : typeof entry.weightKg === 'number'
          ? entry.weightKg
          : typeof entry.weightKg === 'string'
            ? Number.parseFloat(entry.weightKg)
            : typeof entry.weight === 'number'
              ? entry.weight
              : typeof entry.weight === 'string'
                ? Number.parseFloat(entry.weight)
                : null

  const kg = rawKg !== null && Number.isFinite(rawKg) ? Number(rawKg) : null

  if (!ts || kg === null) {
    return null
  }

  return {
    ts,
    kg: Number(kg),
    note:
      typeof entry.note === 'string'
        ? entry.note
        : typeof entry.notes === 'string'
          ? entry.notes
          : undefined,
  }
}

export const normalizeState = (input: unknown): AppState => {
  if (!input || typeof input !== 'object') {
    return createDefaultState()
  }

  const candidate = input as Record<string, unknown>
  const rawEntries = Array.isArray(candidate.entries) ? candidate.entries : []

  const entries = rawEntries
    .map((entry) => (entry && typeof entry === 'object' ? normalizeEntry(entry as Record<string, unknown>) : null))
    .filter((entry): entry is Entry => entry !== null)

  const normalizedEntries = sortAndCleanEntries(entries)

  const profile =
    candidate.profile && typeof candidate.profile === 'object'
      ? ((): AppState['profile'] => {
          const profileCandidate = candidate.profile as Record<string, unknown>
          const rawSex = profileCandidate.sex
          const rawHeight = profileCandidate.height_cm ?? profileCandidate.heightCm
          const rawUnit = profileCandidate.unit ?? 'kg'
          const rawDob =
            typeof profileCandidate.dob === 'string' ? profileCandidate.dob : undefined

          const sex =
            rawSex === 'male' || rawSex === 'female' || rawSex === 'unspecified'
              ? rawSex
              : 'unspecified'
          const height =
            typeof rawHeight === 'number'
              ? rawHeight
              : typeof rawHeight === 'string'
                ? Number.parseFloat(rawHeight)
                : null
          const unit = rawUnit === 'kg' || rawUnit === 'lb' ? rawUnit : 'kg'

          if (height !== null && Number.isFinite(height)) {
            return {
              sex,
              height_cm: Number(height),
              unit,
              dob: rawDob,
            }
          }
          return undefined
        })()
      : undefined

  const goal =
    candidate.goal && typeof candidate.goal === 'object'
      ? ((): AppState['goal'] => {
          const goalCandidate = candidate.goal as Record<string, unknown>
          const rawTarget = goalCandidate.targetKg ?? goalCandidate.target
          const rawStart = goalCandidate.startKg
          const rawStartDate = goalCandidate.startDate

          const target =
            typeof rawTarget === 'number'
              ? rawTarget
              : typeof rawTarget === 'string'
                ? Number.parseFloat(rawTarget)
                : null

          const start =
            typeof rawStart === 'number'
              ? rawStart
              : typeof rawStart === 'string'
                ? Number.parseFloat(rawStart)
                : null

          const hasTarget = target !== null && !Number.isNaN(target)
          const hasStart = start !== null && !Number.isNaN(start)
          const hasStartDate = typeof rawStartDate === 'string'

          if (!hasTarget && !hasStart && !hasStartDate) {
            return undefined
          }

          const goalResult: AppState['goal'] = {}
          if (hasTarget) {
            goalResult.targetKg = Number(target)
          }
          if (hasStart) {
            goalResult.startKg = Number(start)
          }
          if (hasStartDate) {
            goalResult.startDate = rawStartDate
          }

          return goalResult
        })()
      : undefined

  return {
    profile,
    goal,
    entries: normalizedEntries,
  }
}

const getDB = async () =>
  openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })

export const readCachedState = (): AppState => {
  if (typeof window === 'undefined') {
    return createDefaultState()
  }

  const raw = window.localStorage.getItem(LOCAL_CACHE_KEY)
  if (!raw) {
    return createDefaultState()
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeState(parsed)
  } catch {
    return createDefaultState()
  }
}

export const persistState = async (state: AppState): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to cache MASS state in localStorage', error)
    }
  }

  try {
    const db = await getDB()
    await db.put(STORE_NAME, state, STORE_KEY)
  } catch (error) {
    console.warn('Failed to persist MASS state to IndexedDB', error)
  }
}

export const loadPersistedState = async (): Promise<AppState> => {
  try {
    const db = await getDB()
    const stored = (await db.get(STORE_NAME, STORE_KEY)) as MaybeAppState
    return stored ? normalizeState(stored) : createDefaultState()
  } catch (error) {
    console.warn('Failed to load MASS state from IndexedDB', error)
    return createDefaultState()
  }
}

export const clearPersistedState = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LOCAL_CACHE_KEY)
  }

  try {
    const db = await getDB()
    await db.delete(STORE_NAME, STORE_KEY)
  } catch (error) {
    console.warn('Failed to clear MASS state from IndexedDB', error)
  }
}
