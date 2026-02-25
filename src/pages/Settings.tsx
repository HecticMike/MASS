import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMass } from '../context/MassContext'
import styles from './Settings.module.css'
import { useProfileGuard } from '../hooks/useProfileGuard'
import { formatWeight, kgFromInput } from '../utils/weight'

type ProfileFormState = {
  sex: 'male' | 'female' | 'unspecified'
  heightCm: string
  unit: 'kg' | 'lb'
  dob: string
}

const sanitizeNumber = (value: string) => Number.parseFloat(value.replace(',', '.'))

const Settings = () => {
  const { entries, profile, goal, setProfile, setGoal, clearGoal, importState, reset, hydrated } = useMass()
  const ready = useProfileGuard(profile, hydrated)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    sex: 'unspecified',
    heightCm: '',
    unit: 'kg',
    dob: '',
  })
  const [profileError, setProfileError] = useState<string | null>(null)
  const [goalValue, setGoalValue] = useState('')
  const [goalError, setGoalError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<'miguel' | 'ines'>('miguel')
  const [includeSections, setIncludeSections] = useState({
    profile: true,
    goal: true,
    entries: true,
  })
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [startDateValue, setStartDateValue] = useState('')
  const [startWeightValue, setStartWeightValue] = useState('')
  const [startDateError, setStartDateError] = useState<string | null>(null)
  const [startDateMessage, setStartDateMessage] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setProfileForm({
        sex: profile.sex,
        heightCm: profile.height_cm ? String(profile.height_cm) : '',
        unit: profile.unit,
        dob: profile.dob ?? '',
      })
    }
  }, [profile])

  useEffect(() => {
    setGoalValue(goal && typeof goal.targetKg === 'number' ? goal.targetKg.toFixed(1) : '')
  }, [goal])

  // Sync start date fields from goal when it changes
  useEffect(() => {
    if (goal?.startDate) {
      setStartDateValue(goal.startDate.slice(0, 10))
    }
    if (goal?.startKg !== undefined && profile) {
      setStartWeightValue(String(goal.startKg))
    }
  }, [goal, profile])

  // Find the closest entry to the selected start date to suggest a weight
  const entryOnStartDate = useMemo(() => {
    if (!startDateValue || !entries.length) return null
    const targetMs = new Date(startDateValue).getTime()
    if (Number.isNaN(targetMs)) return null
    let closest = entries[0]
    let closestDiff = Math.abs(new Date(entries[0].ts).getTime() - targetMs)
    for (const entry of entries) {
      const diff = Math.abs(new Date(entry.ts).getTime() - targetMs)
      if (diff < closestDiff) {
        closestDiff = diff
        closest = entry
      }
    }
    // Only suggest if the closest entry is within 3 days
    return closestDiff <= 3 * 24 * 60 * 60 * 1000 ? closest : null
  }, [startDateValue, entries])

  if (!ready || !profile) {
    return null
  }

  const handleStartDateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!startDateValue) {
      setStartDateError('Please select a date.')
      return
    }
    const selectedDate = new Date(startDateValue)
    if (Number.isNaN(selectedDate.getTime()) || selectedDate > new Date()) {
      setStartDateError('Start date must be in the past.')
      return
    }

    let resolvedKg: number | undefined
    if (startWeightValue.trim()) {
      const parsed = sanitizeNumber(startWeightValue)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setStartDateError('Weight must be a positive number.')
        return
      }
      resolvedKg = kgFromInput(parsed, profile.unit)
    } else if (entryOnStartDate) {
      resolvedKg = entryOnStartDate.kg
    }

    setGoal({
      targetKg: goal?.targetKg,
      startDate: selectedDate.toISOString(),
      startKg: resolvedKg,
    })
    setStartDateError(null)
    setStartDateMessage('Start date updated.')
    setTimeout(() => setStartDateMessage(null), 3000)
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
      dob: profileForm.dob || undefined,
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
    if (!includeSections.profile && !includeSections.goal && !includeSections.entries) {
      setBackupMessage('Select at least one section to include in the backup.')
      return
    }

    const payload: Record<string, unknown> = {
      user: selectedUser,
      generatedAt: new Date().toISOString(),
    }

    if (includeSections.profile) {
      payload.profile = profile
    }
    if (includeSections.goal) {
      payload.goal = goal
    }
    if (includeSections.entries) {
      payload.entries = entries
    }

    const fileName = selectedUser === 'miguel' ? 'mass-miguel.json' : 'mass-ines.json'
    downloadFile(JSON.stringify(payload, null, 2), fileName, 'application/json')
    setBackupMessage(`Backup downloaded as ${fileName}.`)
  }

  const handleRestoreBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        const result = importState(parsed)
        setBackupMessage(
          `Restored ${result.entries} log(s)${result.hasProfile ? ' and profile' : ''}. `,
        )
      } catch {
        setBackupMessage('Could not read this file. Make sure it is a valid MASS backup.')
      }
      // Reset input so the same file can be re-selected
      if (restoreInputRef.current) {
        restoreInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleSectionToggle = (section: keyof typeof includeSections) => {
    setIncludeSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  const entryCount = entries.length
  const includeSectionItems: Array<{ key: keyof typeof includeSections; label: string }> = [
    { key: 'profile', label: 'Profile' },
    { key: 'goal', label: 'Goal' },
    { key: 'entries', label: 'Entries' },
  ]

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
            <label className={styles.label} htmlFor="dob">
              Date of birth
            </label>
            <input
              id="dob"
              name="dob"
              type="date"
              value={profileForm.dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setProfileForm((state) => ({ ...state, dob: event.target.value }))}
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
        <h3 className={styles.sectionTitle}>Start date</h3>
        <p className={styles.info}>
          Override when your progress tracking begins. Pick any past date — if you have a log on or near that day, its weight will be pre-filled.
        </p>
        <form className={styles.form} onSubmit={handleStartDateSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="startDate">
              Date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              value={startDateValue}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                setStartDateValue(event.target.value)
                setStartDateMessage(null)
              }}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="startWeight">
              Starting weight ({profile.unit})
            </label>
            <input
              id="startWeight"
              name="startWeight"
              inputMode="decimal"
              step="0.1"
              value={startWeightValue}
              onChange={(event) => setStartWeightValue(event.target.value)}
              placeholder={
                entryOnStartDate
                  ? `Log on this date: ${formatWeight(entryOnStartDate.kg, profile.unit)}`
                  : 'e.g. 80.0'
              }
            />
            {entryOnStartDate && !startWeightValue ? (
              <p className={styles.info}>
                Using log from {new Date(entryOnStartDate.ts).toLocaleDateString()}: {formatWeight(entryOnStartDate.kg, profile.unit)}
              </p>
            ) : null}
          </div>
          {startDateError ? (
            <p className={styles.infoError}>{startDateError}</p>
          ) : null}
          {startDateMessage ? (
            <p className={styles.infoSuccess}>{startDateMessage}</p>
          ) : null}
          <div className={styles.controls}>
            <button type="submit">Save start date</button>
          </div>
        </form>
      </article>

      <article className={styles.card}>
        <h3 className={styles.sectionTitle}>Data &amp; Sync</h3>
        <p className={styles.info}>
          MASS stores everything locally. Export or back up whenever you like.
        </p>

        <div className={styles.field}>
          <span className={styles.label}>Backup for</span>
          <div className={styles.radioGroup}>
            <button
              type="button"
              className={`${styles.radioButton} ${selectedUser === 'miguel' ? styles.radioActive : ''}`}
              onClick={() => setSelectedUser('miguel')}
            >
              Miguel
            </button>
            <button
              type="button"
              className={`${styles.radioButton} ${selectedUser === 'ines' ? styles.radioActive : ''}`}
              onClick={() => setSelectedUser('ines')}
            >
              Ines
            </button>
          </div>
          <p className={styles.info}>
            File: {selectedUser === 'miguel' ? 'mass-miguel.json' : 'mass-ines.json'}
          </p>
        </div>

        <div className={styles.field}>
          <span className={`${styles.label} ${styles.checkboxPanelLabel}`}>Include sections</span>
          <div className={styles.checkboxPanel}>
            <div className={styles.checkboxGroup}>
              {includeSectionItems.map((item) => (
                <label key={item.key} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={includeSections[item.key]}
                    onChange={() => handleSectionToggle(item.key)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.controls}>
          <button type="button" onClick={handleExportCsv} disabled={entryCount === 0}>
            Export CSV
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={handleBackupJson}>
            Download backup
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => restoreInputRef.current?.click()}
          >
            Restore backup
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreBackup}
            hidden
          />
        </div>

        <p className={styles.info}>
          <strong>{entryCount}</strong> log(s) stored on this device.
        </p>
        {backupMessage ? <p className={styles.info}>{backupMessage}</p> : null}

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
