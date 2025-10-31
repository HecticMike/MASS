import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMass } from '../context/MassContext'
import { roundTo } from '../utils/weight'
import styles from './Onboarding.module.css'

type HeightMode = 'cm' | 'imperial'

type OnboardingFormState = {
  sex: 'male' | 'female' | 'unspecified'
  unit: 'kg' | 'lb'
  heightMode: HeightMode
  heightCm: string
  heightFt: string
  heightIn: string
  targetKg: string
}

const parseNumber = (value: string) => {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

const cmToImperial = (cm: number) => {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round((totalInches - feet * 12) * 10) / 10
  return {
    feet,
    inches,
  }
}

const imperialToCm = (feet: number, inches: number) => (feet * 12 + inches) * 2.54

const buildInitialForm = (
  params: Partial<OnboardingFormState> & { heightCmValue?: number },
): OnboardingFormState => {
  const heightCmNumeric = params.heightCmValue
  const conversion =
    heightCmNumeric && heightCmNumeric > 0 ? cmToImperial(heightCmNumeric) : undefined

  return {
    sex: params.sex ?? 'unspecified',
    unit: params.unit ?? 'kg',
    heightMode: 'cm',
    heightCm: params.heightCm ?? (heightCmNumeric ? String(Math.round(heightCmNumeric)) : ''),
    heightFt:
      params.heightFt ?? (conversion ? String(conversion.feet) : ''),
    heightIn:
      params.heightIn ??
      (conversion
        ? (conversion.inches > 0 ? conversion.inches.toFixed(1).replace(/\.0$/, '') : '0')
        : ''),
    targetKg: params.targetKg ?? '',
  }
}

const Onboarding = () => {
  const navigate = useNavigate()
  const { profile, goal, setProfile, setGoal, clearGoal } = useMass()

  const derivedInitial = useMemo(() => {
    const target = goal?.targetKg
    return buildInitialForm({
      sex: profile?.sex,
      unit: profile?.unit,
      heightCmValue: profile?.height_cm,
      targetKg: typeof target === 'number' ? roundTo(target).toFixed(1) : '',
    })
  }, [profile, goal])

  const [form, setForm] = useState<OnboardingFormState>(derivedInitial)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(derivedInitial)
  }, [derivedInitial])

  const handleHeightModeChange = (mode: HeightMode) => {
    setForm((current) => {
      if (current.heightMode === mode) {
        return current
      }

      if (mode === 'imperial') {
        const cmValue = parseNumber(current.heightCm)
        if (Number.isFinite(cmValue) && cmValue > 0) {
          const { feet, inches } = cmToImperial(cmValue)
          return {
            ...current,
            heightMode: 'imperial',
            heightFt: String(feet),
            heightIn: inches > 0 ? inches.toFixed(1).replace(/\.0$/, '') : '0',
          }
        }
        return { ...current, heightMode: 'imperial' }
      }

      const feetValue = parseNumber(current.heightFt)
      const inchValue = parseNumber(current.heightIn)
      if (Number.isFinite(feetValue) && feetValue >= 0) {
        const safeInches = Number.isFinite(inchValue) && inchValue >= 0 ? inchValue : 0
        const cm = Math.round(imperialToCm(feetValue, safeInches))
        return { ...current, heightMode: 'cm', heightCm: cm > 0 ? String(cm) : '' }
      }
      return { ...current, heightMode: 'cm' }
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    let resolvedHeightCm: number | null = null
    if (form.heightMode === 'cm') {
      const cm = parseNumber(form.heightCm)
      if (!Number.isFinite(cm) || cm < 120) {
        setError('Please provide a height of at least 120 cm.')
        return
      }
      resolvedHeightCm = Math.round(cm)
    } else {
      const feet = parseNumber(form.heightFt)
      const inches = parseNumber(form.heightIn || '0')
      if (!Number.isFinite(feet) || feet < 0) {
        setError('Please add height feet and inches.')
        return
      }
      const safeInches = Number.isFinite(inches) && inches >= 0 ? inches : 0
      const cm = imperiallyBoundedHeight(feet, safeInches)
      if (cm < 120) {
        setError('Please provide a height of at least 120 cm.')
        return
      }
      resolvedHeightCm = Math.round(cm)
    }

    if (resolvedHeightCm === null) {
      setError('Please add your height.')
      return
    }

    const targetValue = form.targetKg.trim()
    let resolvedTargetKg: number | null = null
    if (targetValue.length > 0) {
      const parsedTarget = parseNumber(targetValue)
      if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
        setError('Target weight must be a positive number in kilograms.')
        return
      }
      resolvedTargetKg = roundTo(parsedTarget)
    }

    setProfile({
      sex: form.sex,
      height_cm: resolvedHeightCm,
      unit: form.unit,
    })

    if (resolvedTargetKg !== null) {
      setGoal({
        targetKg: resolvedTargetKg,
        startKg: goal?.startKg,
        startDate: goal?.startDate,
      })
    } else {
      clearGoal()
    }

    setError(null)
    navigate('/log', { replace: true })
  }

  return (
    <section className={styles.container}>
      <article className={styles.intro}>
        <h2 className={styles.introTitle}>Welcome to MASS</h2>
        <p className={styles.introCopy}>
          Capture a few basics so your dashboard and logs reflect the right ranges for you.
        </p>
      </article>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <span className={styles.label}>Sex</span>
          <div className={styles.optionGroup} role="radiogroup" aria-label="Sex">
            {(['female', 'male', 'unspecified'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={[
                  styles.optionButton,
                  form.sex === value ? styles.optionButtonActive : '',
                ].join(' ')}
                aria-pressed={form.sex === value}
                onClick={() => setForm((state) => ({ ...state, sex: value }))}
              >
                {value === 'unspecified' ? 'Prefer not to say' : value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="height">
              Height
            </label>
            <div className={styles.heightToggle}>
              <button
                type="button"
                className={[
                  styles.optionButton,
                  form.heightMode === 'cm' ? styles.optionButtonActive : '',
                ].join(' ')}
                onClick={() => handleHeightModeChange('cm')}
              >
                cm
              </button>
              <button
                type="button"
                className={[
                  styles.optionButton,
                  form.heightMode === 'imperial' ? styles.optionButtonActive : '',
                ].join(' ')}
                onClick={() => handleHeightModeChange('imperial')}
              >
                ft / in
              </button>
            </div>
          </div>

          <div className={styles.heightInputs}>
            {form.heightMode === 'cm' ? (
              <input
                id="height"
                name="heightCm"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.heightCm}
                onChange={(event) => setForm((state) => ({ ...state, heightCm: event.target.value }))}
                placeholder="e.g. 175"
              />
            ) : (
              <div className={styles.imperialInputs}>
                <input
                  id="heightFt"
                  name="heightFt"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.heightFt}
                  onChange={(event) => setForm((state) => ({ ...state, heightFt: event.target.value }))}
                  placeholder="Feet"
                  aria-label="Height feet"
                />
                <input
                  id="heightIn"
                  name="heightIn"
                  inputMode="decimal"
                  value={form.heightIn}
                  onChange={(event) => setForm((state) => ({ ...state, heightIn: event.target.value }))}
                  placeholder="Inches"
                  aria-label="Height inches"
                />
              </div>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Preferred unit</span>
          <div className={styles.optionGroup}>
            {(['kg', 'lb'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={[
                  styles.optionButton,
                  form.unit === value ? styles.optionButtonActive : '',
                ].join(' ')}
                onClick={() => setForm((state) => ({ ...state, unit: value }))}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="targetKg">
              Target weight (kg)
            </label>
            <span className={styles.hint}>Optional</span>
          </div>
          <input
            id="targetKg"
            name="targetKg"
            inputMode="decimal"
            step="0.1"
            value={form.targetKg}
            onChange={(event) => setForm((state) => ({ ...state, targetKg: event.target.value }))}
            placeholder="e.g. 70.5"
          />
        </div>

        <p className={styles.note}>
          BMI is a general index that doesn't account for body composition. Adults only.
        </p>

        {error ? (
          <p role="alert" className={styles.hint} style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit">Start logging</button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => navigate('/log')}
          >
            Skip for now
          </button>
        </div>
      </form>
    </section>
  )
}

const imperiallyBoundedHeight = (feet: number, inches: number) => {
  const safeFeet = Math.max(feet, 0)
  const safeInches = Math.min(Math.max(inches, 0), 11.99)
  return imperialToCm(safeFeet, safeInches)
}

export default Onboarding
