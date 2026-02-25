import { useState } from 'react'
import BmiPill from '../components/BmiPill'
import TrendsChart from '../components/TrendsChart'
import { useMass } from '../context/MassContext'
import styles from './Dashboard.module.css'
import { format } from '../utils/date'
import { formatWeight, fromKg, roundTo } from '../utils/weight'
import { summarizeProgress } from '../utils/progress'
import { useProfileGuard } from '../hooks/useProfileGuard'
import { forecastWeeklyWeights } from '../utils/trend'

const DEURENBERG_VISIBLE_KEY = 'mass-deurenberg-visible'

const readDeurenbergVisible = (): boolean => {
  try {
    const stored = window.localStorage.getItem(DEURENBERG_VISIBLE_KEY)
    return stored === null ? true : stored !== 'false'
  } catch {
    return true
  }
}

const formatChange = (delta: number | null, unit: 'kg' | 'lb') => {
  if (delta === null) {
    return '--'
  }
  const converted = roundTo(fromKg(delta, unit))
  if (Math.abs(converted) < 0.05) {
    return `0.0 ${unit}`
  }
  return `${converted > 0 ? '+' : ''}${converted.toFixed(1)} ${unit}`
}

const changeClass = (delta: number | null) => {
  if (delta === null || delta === 0) {
    return ''
  }
  return delta < 0 ? styles.deltaNegative : styles.deltaPositive
}

const Dashboard = () => {
  const { entries, profile, goal, hydrated } = useMass()
  const ready = useProfileGuard(profile, hydrated)
  const [deurenbergVisible, setDeurenbergVisible] = useState<boolean>(readDeurenbergVisible)

  if (!ready || !profile) {
    return null
  }

  const unit = profile.unit ?? 'kg'
  const summary = summarizeProgress(entries, goal)
  const hasData = summary.latestKg !== null
  const resolvedSex = profile.sex === 'female' ? 'female' : 'male'
  const forecastResult = forecastWeeklyWeights(entries)

  const toggleDeurenberg = () => {
    setDeurenbergVisible((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(DEURENBERG_VISIBLE_KEY, String(next))
      } catch {}
      return next
    })
  }

  return (
    <section className={styles.container}>
      {hasData ? (
        <div className={styles.bmiPillWrapper}>
          {deurenbergVisible ? (
            <BmiPill
              heightCm={profile.height_cm}
              weightKg={summary.latestKg!}
              sex={resolvedSex}
              dob={profile.dob}
            />
          ) : null}
          <button
            type="button"
            className={styles.deurenbergToggle}
            onClick={toggleDeurenberg}
            aria-pressed={deurenbergVisible ? 'true' : 'false'}
          >
            {deurenbergVisible ? 'Hide body fat' : 'Show body fat'}
          </button>
        </div>
      ) : null}

      {hasData ? (
        <article className={styles.card}>
          <div className={styles.progressGrid}>
            <div className={styles.progressRow}>
              <span className={styles.label}>Start</span>
              <span className={styles.value}>
                {summary.startKg !== null ? formatWeight(summary.startKg, unit) : '--'}
              </span>
            </div>
            <div className={styles.progressRow}>
              <span className={styles.label}>Latest</span>
              <span className={styles.value}>
                {summary.latestKg !== null ? formatWeight(summary.latestKg, unit) : '--'}
              </span>
            </div>
            {summary.targetKg !== null ? (
              <div className={styles.progressRow}>
                <span className={styles.label}>Target</span>
                <span className={styles.value}>{formatWeight(summary.targetKg, unit)}</span>
              </div>
            ) : null}
            <div className={styles.progressRow}>
              <span className={styles.label}>Since first</span>
              <span className={`${styles.value} ${changeClass(summary.deltaTotal)}`}>
                {formatChange(summary.deltaTotal, unit)}
              </span>
            </div>
            <div className={styles.progressRow}>
              <span className={styles.label}>Since previous</span>
              <span className={`${styles.value} ${changeClass(summary.deltaSincePrev)}`}>
                {formatChange(summary.deltaSincePrev, unit)}
              </span>
            </div>
            {summary.firstEntryDate ? (
              <div className={styles.progressRow}>
                <span className={styles.label}>Started</span>
                <span className={styles.value}>{format(summary.firstEntryDate)}</span>
              </div>
            ) : null}
          </div>
        </article>
      ) : (
        <div className={styles.placeholder}>
          Once you add a weight log, progress and trends will appear here.
        </div>
      )}

      {forecastResult ? (
        <article className={`${styles.card} ${styles.prediction}`}>
          <div className={styles.predictionHeader}>
            <span className={styles.label}>Next month outlook</span>
            <span className={styles.predictionBadge}>
              {forecastResult.model === 'exponential' ? 'Exponential' : 'Linear'}
            </span>
          </div>
          <ul className={styles.predictionList}>
            {forecastResult.forecasts.map((forecast, index) => (
              <li key={forecast.date} className={styles.predictionRow}>
                <span>Week {index + 1}</span>
                <span>{format(forecast.date)}</span>
                <span className={styles.predictionValue}>{formatWeight(forecast.kg, unit)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.predictionCopy}>
            {forecastResult.model === 'exponential'
              ? 'Projection uses a slowing (exponential) trend, so losses taper as you near a plateau.'
              : 'Projection uses a weighted linear trend based on your recent data.'}
          </p>
        </article>
      ) : null}

      <article className={styles.card}>
        <TrendsChart entries={entries} unit={unit} />
      </article>
    </section>
  )
}

export default Dashboard
