import { roundTo } from './weight'
import type { Entry } from '../types/app'

const TEN_MINUTES_MS = 10 * 60 * 1000

const getLocalDateKey = (ts: string) => {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) {
    return ts
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export const sortEntriesAscending = (entries: Entry[]) =>
  [...entries].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  )

export const deduplicateEntries = (entries: Entry[]) => {
  if (entries.length <= 1) {
    return entries
  }

  const sorted = sortEntriesAscending(entries)
  const result: Entry[] = []

  for (const entry of sorted) {
    const last = result[result.length - 1]
    if (!last) {
      result.push(entry)
      continue
    }

    const currentTime = new Date(entry.ts).getTime()
    const lastTime = new Date(last.ts).getTime()
    if (Number.isNaN(currentTime) || Number.isNaN(lastTime)) {
      result.push(entry)
      continue
    }

    const withinWindow = currentTime - lastTime <= TEN_MINUTES_MS && currentTime >= lastTime
    const sameDay = getLocalDateKey(entry.ts) === getLocalDateKey(last.ts)
    const sameRoundedWeight = roundTo(entry.kg) === roundTo(last.kg)
    const sameNote = (entry.note ?? '').trim() === (last.note ?? '').trim()

    if (withinWindow && sameDay && sameRoundedWeight && sameNote) {
      result[result.length - 1] = entry
    } else {
      result.push(entry)
    }
  }

  return result
}

export const sortAndCleanEntries = (entries: Entry[]) =>
  deduplicateEntries(sortEntriesAscending(entries))
