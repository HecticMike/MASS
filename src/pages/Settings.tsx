import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMass } from '../context/MassContext'
import styles from './Settings.module.css'
import { syncToDriveJson, syncToGoogleSheets } from '../services/sync'
import { useProfileGuard } from '../hooks/useProfileGuard'

type ProfileFormState = {
  sex: 'male' | 'female' | 'unspecified'
  heightCm: string
  unit: 'kg' | 'lb'
}

const sanitizeNumber = (value: string) => Number.parseFloat(value.replace(',', '.'))

const Settings = () => {
  const { entries, profile, goal, setProfile, setGoal, clearGoal, reset, hydrated } = useMass()
  const ready = useProfileGuard(profile, hydrated)

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    sex: 'unspecified',
    heightCm: '',
    unit: 'kg',
  })
  const [profileError, setProfileError] = useState<string | null>(null)
  const [goalValue, setGoalValue] = useState('')
  const [goalError, setGoalError] = useState<string | null>(null)
  const [sheetsEnabled, setSheetsEnabled] = useState(false)
  const [driveEnabled, setDriveEnabled] = useState(false)

  useEffect(() => {
    if (profile) {
      setProfileForm({
        sex: profile.sex,
        heightCm: profile.height_cm ? String(profile.height_cm) : '',
        unit: profile.unit,
      })
    }
  }, [profile])

  useEffect(() => {
    setGoalValue(goal && typeof goal.targetKg === 'number' ? goal.targetKg.toFixed(1) : '')
  }, [goal])

  if (!ready || !profile) {
    return null
  }

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const height = Number.parseInt(profileForm.heightCm, 10)
    if (!Number.isFinite(height) || height < 120) {
      setProfileError('Height should be at least 120 cm.')
      return
    }
    setProfile({
      sex: profileForm.sex,
      height_cm: height,
      unit: profileForm.unit,
    })
    setProfileError(null)
  }

  const handleGoalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!goalValue.trim()) {
      setGoalError('Enter a target weight or clear the goal.')
      return
    }
    const parsed = sanitizeNumber(goalValue)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGoalError('Target weight must be a positive number.')
      return
    }
    setGoal({
      targetKg: Number(parsed.toFixed(1)),
      startKg: goal?.startKg,
      startDate: goal?.startDate,
    })
    setGoalError(null)
  }

  const handleClearGoal = () => {
    clearGoal()
    setGoalValue('')
    setGoalError(null)
  }

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCsv = () => {
    if (!entries.length) {
      return
    }
    const header = 'ts,date,time,kg,note'
    const rows = entries
      .slice()
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map((entry) => {
        const timestamp = new Date(entry.ts)
        const date = timestamp.toISOString().slice(0, 10)
        const time = timestamp.toISOString().slice(11, 19)
        const escapedNote = entry.note ? entry.note.replace(/"/g, '""') : ''
        return `"${entry.ts}","${date}","${time}",${entry.kg.toFixed(1)},"${escapedNote}"`
      })
    const csv = [header, ...rows].join('\n')
    downloadFile(csv, 'mass-logs.csv', 'text/csv;charset=utf-8')
  }

  const handleBackupJson = () => {
    const state = {
      profile,
      goal,
      entries,
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(
      JSON.stringify(state, null, 2),
      `app-state-${stamp}.json`,
      'application/json',
    )
  }

  const handleSheetsToggle = () => {
    const next = !sheetsEnabled
    setSheetsEnabled(next)
    void syncToGoogleSheets(entries)
  }

  const handleDriveToggle = () => {
    const next = !driveEnabled
    setDriveEnabled(next)
    void syncToDriveJson({ profile, goal, entries })
  }

  const entryCount = entries.length

  return (
    <section className={styles.container}>
      <article className={styles.card}>
        <h3 className={styles.sectionTitle}>Profile</h3>
        <form className={styles.form} onSubmit={handleProfileSubmit}>
          <div className={styles.field}>
            <span className={styles.label}>Sex</span>
            <div className={styles.radioGroup}>
              {(['female', 'male', 'unspecified'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.radioButton} ${profileForm.sex === value ? styles.radioActive : ''}`}
                  onClick={() => setProfileForm((state) => ({ ...state, sex: value }))}
                >
                  {value === 'unspecified'
                    ? 'Prefer not to say'
                    : value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="height">
              Height (cm)
            </label>
            <input
              id="height"
              name="height"
              inputMode="numeric"
              pattern="[0-9]*"
              min={120}
              value={profileForm.heightCm}
              onChange={(event) => setProfileForm((state) => ({ ...state, heightCm: event.target.value }))}
              placeholder="e.g. 178"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Preferred unit</span>
            <div className={styles.radioGroup}>
              {(['kg', 'lb'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.radioButton} ${profileForm.unit === value ? styles.radioActive : ''}`}
                  onClick={() => setProfileForm((state) => ({ ...state, unit: value }))}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {profileError ? (
            <p className={styles.info} style={{ color: 'var(--danger)' }}>
              {profileError}
            </p>
          ) : null}

          <div className={styles.controls}>
            <button type="submit">Save profile</button>
          </div>
        </form>
      </article>

      <article className={styles.card}>
        <h3 className={styles.sectionTitle}>Goal</h3>
        <form className={styles.form} onSubmit={handleGoalSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="target">
              Target weight (kg)
            </label>
            <input
              id="target"
              name="target"
              inputMode="decimal"
              step="0.1"
              value={goalValue}
              onChange={(event) => setGoalValue(event.target.value)}
              placeholder="e.g. 72.0"
            />
          </div>
          {goalError ? (
            <p className={styles.info} style={{ color: 'var(--danger)' }}>
              {goalError}
            </p>
          ) : null}
          <div className={styles.controls}>
            <button type="submit">Save goal</button>
            <button type="button" className={styles.buttonSecondary} onClick={handleClearGoal}>
              Clear goal
            </button>
          </div>
        </form>
      </article>

      <article className={styles.card}>
        <h3 className={styles.sectionTitle}>Data &amp; Sync</h3>
        <p className={styles.info}>
          MASS stores everything locally. Export or back up whenever you like.
        </p>
        <div className={styles.controls}>
          <button type="button" onClick={handleExportCsv} disabled={entryCount === 0}>
            Export CSV
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={handleBackupJson}>
            Backup JSON
          </button>
        </div>

        <div className={styles.toggleRow}>
          <span>Sync with Google Sheets</span>
          <div className={styles.toggleActions}>
            <button type="button" className={styles.buttonSecondary} onClick={handleSheetsToggle}>
              {sheetsEnabled ? 'Disable' : 'Trigger'}
            </button>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <span>Sync with Drive JSON</span>
          <div className={styles.toggleActions}>
            <button type="button" className={styles.buttonSecondary} onClick={handleDriveToggle}>
              {driveEnabled ? 'Disable' : 'Trigger'}
            </button>
          </div>
        </div>

        <p className={styles.info}>
          <strong>{entryCount}</strong> log(s) stored on this device.
        </p>

        <button
          type="button"
          className={styles.danger}
          onClick={async () => {
            if (window.confirm('Reset MASS data on this device? This cannot be undone.')) {
              await reset()
            }
          }}
        >
          Reset local data
        </button>
      </article>
    </section>
  )
}

export default Settings
