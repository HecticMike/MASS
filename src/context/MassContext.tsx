import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearPersistedState,
  loadPersistedState,
  normalizeState,
  persistState,
  readCachedState,
} from '../services/persistence'
import type { AppState, Entry, Goal, Profile } from '../types/app'
import { createDefaultState } from '../types/app'
import { kgFromInput } from '../utils/weight'
import { sortAndCleanEntries } from '../utils/entries'

type AddEntryInput = {
  value: number
  unit?: 'kg' | 'lb'
  ts?: string
  note?: string
}

type MassContextValue = {
  profile?: Profile
  goal?: Goal
  entries: Entry[]
  hydrated: boolean
  setProfile: (profile: Profile) => void
  setGoal: (goal: Goal) => void
  clearGoal: () => void
  addEntry: (entry: AddEntryInput) => Entry | null
  removeEntry: (entry: Entry) => void
  importState: (raw: unknown) => { entries: number; hasProfile: boolean }
  reset: () => Promise<void>
}

const MassContext = createContext<MassContextValue | undefined>(undefined)

export const MassProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(() => {
    const initial = readCachedState()
    return {
      ...initial,
      entries: sortAndCleanEntries(initial.entries),
    }
  })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const persisted = await loadPersistedState()
      if (!active) {
        return
      }
      setState({
        ...persisted,
        entries: sortAndCleanEntries(persisted.entries),
      })
      setHydrated(true)
    })()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    void persistState(state)
  }, [state])

  const setProfile = useCallback((profile: Profile) => {
    setState((current) => ({ ...current, profile }))
  }, [])

  const setGoal = useCallback((goal: Goal) => {
    setState((current) => ({ ...current, goal }))
  }, [])

  const clearGoal = useCallback(() => {
    setState((current) => ({ ...current, goal: undefined }))
  }, [])

  const addEntry = useCallback(({ value, unit, note, ts }: AddEntryInput): Entry | null => {
    if (!Number.isFinite(value) || value <= 0) {
      return null
    }

    let createdEntry: Entry | null = null

    setState((current) => {
      const resolvedUnit = unit ?? current.profile?.unit ?? 'kg'
      const kg = kgFromInput(value, resolvedUnit)
      const entry: Entry = {
        ts: ts ?? new Date().toISOString(),
        kg,
        note: note?.trim() ? note.trim() : undefined,
      }
      createdEntry = entry

      let nextGoal: Goal | undefined = current.goal
      if (nextGoal) {
        if (typeof nextGoal.startKg !== 'number') {
          nextGoal = { ...nextGoal, startKg: kg, startDate: entry.ts }
        }
      } else {
        nextGoal = { startKg: kg, startDate: entry.ts }
      }

      const nextEntries = sortAndCleanEntries([...current.entries, entry])

      return {
        ...current,
        goal: nextGoal,
        entries: nextEntries,
      }
    })

    return createdEntry
  }, [])

  const removeEntry = useCallback((target: Entry) => {
    setState((current) => {
      let removed = false
      const filtered = current.entries.filter((entry) => {
        if (
          !removed &&
          entry.ts === target.ts &&
          entry.kg === target.kg &&
          (entry.note ?? '') === (target.note ?? '')
        ) {
          removed = true
          return false
        }
        return true
      })

      return {
        ...current,
        entries: sortAndCleanEntries(filtered),
      }
    })
  }, [])

  const importState = useCallback((raw: unknown): { entries: number; hasProfile: boolean } => {
    const imported = normalizeState(raw)
    const cleaned = {
      ...imported,
      entries: sortAndCleanEntries(imported.entries),
    }
    setState(cleaned)
    return {
      entries: cleaned.entries.length,
      hasProfile: !!cleaned.profile,
    }
  }, [])

  const reset = useCallback(async () => {
    setState(createDefaultState())
    await clearPersistedState()
  }, [])

  const value = useMemo<MassContextValue>(
    () => ({
      profile: state.profile,
      goal: state.goal,
      entries: state.entries,
      hydrated,
      setProfile,
      setGoal,
      clearGoal,
      addEntry,
      removeEntry,
      importState,
      reset,
    }),
    [state, hydrated, setProfile, setGoal, clearGoal, addEntry, removeEntry, importState, reset],
  )

  return <MassContext.Provider value={value}>{children}</MassContext.Provider>
}

export const useMass = () => {
  const context = useContext(MassContext)
  if (!context) {
    throw new Error('useMass must be used within a MassProvider')
  }

  return context
}

export type { AddEntryInput }

