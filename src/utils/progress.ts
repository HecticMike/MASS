import type { Entry, Goal } from '../types/app'

type ProgressSummary = {
  startKg: number | null
  latestKg: number | null
  targetKg: number | null
  deltaTotal: number | null
  deltaSincePrev: number | null
  firstEntryDate?: string
}

export const summarizeProgress = (entries: Entry[], goal?: Goal): ProgressSummary => {
  if (!entries || entries.length === 0) {
    return {
      startKg: goal?.startKg ?? null,
      latestKg: null,
      targetKg: goal?.targetKg ?? null,
      deltaTotal: null,
      deltaSincePrev: null,
      firstEntryDate: undefined,
    }
  }

  const ordered = [...entries].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  const first = ordered[0]!
  const latest = ordered[ordered.length - 1]!
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null

  const startKg = goal?.startKg ?? first.kg
  const targetKg = goal?.targetKg ?? null

  const deltaTotal = latest.kg - startKg
  const deltaSincePrev = previous ? latest.kg - previous.kg : null

  return {
    startKg,
    latestKg: latest.kg,
    targetKg,
    deltaTotal,
    deltaSincePrev,
    firstEntryDate: first.ts,
  }
}
