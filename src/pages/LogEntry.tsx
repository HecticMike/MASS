import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { format, formatTime } from '../utils/date'
import { useMass } from '../context/MassContext'
import { formatWeight, roundTo } from '../utils/weight'
import Toast from '../components/Toast'
import styles from './LogEntry.module.css'
import { useProfileGuard } from '../hooks/useProfileGuard'

const parseNumber = (value: string) => {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

const pad = (value: number) => value.toString().padStart(2, '0')

const toLocalInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`

const getNowInputValue = () => toLocalInputValue(new Date())

const formatMoment = (value: string) => {
  if (!value) {
    return ''
  }
  const instance = new Date(value)
  if (Number.isNaN(instance.getTime())) {
    return ''
  }
  const now = new Date()
  const sameDay = instance.toDateString() === now.toDateString()
  const label = sameDay ? 'Today' : format(instance.toISOString())
  return `${label} \u00B7 ${pad(instance.getHours())}:${pad(instance.getMinutes())}`
}

const LogEntry = () => {
  const { addEntry, entries, profile, hydrated } = useMass()
  const canRender = useProfileGuard(profile, hydrated)

  const orderedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
      ),
    [entries],
  )

  if (!canRender) {
    return null
  }

  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [dateTime, setDateTime] = useState(getNowInputValue)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const unit = profile?.unit ?? 'kg'
  const step = unit === 'kg' ? 0.1 : 0.2
  const displayUnit = unit

  const summary = useMemo(() => formatMoment(dateTime), [dateTime])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseNumber(weight)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Weight must be a positive number.')
      return
    }

    const selected = new Date(dateTime)
    if (Number.isNaN(selected.getTime())) {
      setError('Please pick a valid date and time.')
      return
    }

    const entry = addEntry({
      value: parsed,
      unit,
      ts: selected.toISOString(),
      note,
    })

    if (!entry) {
      setError('Unable to save this log. Please try again.')
      return
    }

    setError(null)
    const normalizedKg = roundTo(entry.kg).toFixed(1)
    setToast(`Logged ${normalizedKg} kg`)
    setWeight('')
    setNote('')
    setDateTime(getNowInputValue())
  }

  return (
    <section className={styles.container}>
      <article className={styles.card}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.summaryRow}>
            <h2 className={styles.heading}>Morning check-in</h2>
            <p className={styles.moment}>{summary || 'Choose a time'}</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="weight">
              Weight ({unit})
            </label>
            <input
              id="weight"
              name="weight"
              inputMode="decimal"
              step={step}
              placeholder={unit === 'kg' ? 'e.g. 72.4' : 'e.g. 160.0'}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="timestamp">
              Logged at
            </label>
            <input
              id="timestamp"
              name="timestamp"
              type="datetime-local"
              value={dateTime}
              onChange={(event) => setDateTime(event.target.value)}
              className={styles.datetime}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="note">
              Note
            </label>
            <input
              id="note"
              name="note"
              type="text"
              placeholder="Optional detail (gym, travel, etc.)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className={styles.feedback}>
              {error}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="submit">Save</button>
          </div>
        </form>
      </article>

      <section className={styles.history} aria-live="polite">
        <h3 className={styles.label}>Recent logs</h3>
        {orderedEntries.length === 0 ? (
          <p className={styles.emptyState}>Your logs will appear here after you save.</p>
        ) : (
          <ul className={styles.historyList}>
            {orderedEntries.map((entry, index) => (
              <li key={`${entry.ts}-${index}`} className={styles.historyItem}>
                <div className={styles.historyRow}>
                  <span className={styles.historyPrimary}>{formatWeight(entry.kg, displayUnit)}</span>
                  <span className={styles.historySecondary}>
                    {format(entry.ts)} · {formatTime(entry.ts)}
                  </span>
                </div>
                {entry.note ? <p className={styles.historySecondary}>{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast ? <Toast message={toast} /> : null}
    </section>
  )
}

export default LogEntry

