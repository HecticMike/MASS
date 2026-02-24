import type { Sex } from '../types/app'
import {
  bodyFatDomain,
  bodyFatPercentage,
  bodyFatSegments,
  bodyFatTableForAge,
  classifyBodyFat,
  kgToBmi,
} from '../utils/bmi'
import { ageFromDob } from '../utils/bmi'
import styles from './BmiPill.module.css'

type BodyFatProps = {
  heightCm: number
  weightKg: number
  sex?: Sex
  dob?: string
}

const BmiPill = ({ heightCm, weightKg, sex = 'male', dob }: BodyFatProps) => {
  if (!heightCm || !weightKg) {
    return null
  }

  const bmi = kgToBmi(weightKg, heightCm)
  const age = ageFromDob(dob)

  if (!age || age < 16) {
    return (
      <div className={styles.pill}>
        <div className={styles.topRow}>
          <span className={styles.label}>Body fat</span>
          <span className={styles.value}>--%</span>
        </div>
        <p className={styles.rangeText}>
          Add your birth date to estimate body fat and see tailored targets.
        </p>
      </div>
    )
  }

  const percentage = bodyFatPercentage(bmi, age, sex)
  const category = classifyBodyFat(percentage, sex, age)
  const segments = bodyFatSegments(sex, age)
  const dynamicTable = bodyFatTableForAge(age)
  const domain = bodyFatDomain(sex, age)
  const clamped = Math.min(Math.max(percentage, domain.min), domain.max)
  const markerRatio = (clamped - domain.min) / (domain.max - domain.min)
  const formatRangeValue = (value: number) => {
    if (Math.abs(value - Math.round(value)) < 0.05) {
      return `${Math.round(value)}`
    }
    return value.toFixed(1)
  }

  return (
    <div className={styles.pill}>
      <div className={styles.topRow}>
        <span className={styles.label}>Body fat</span>
        <span className={styles.value}>{percentage.toFixed(1)}%</span>
        <span className={styles.category} style={{ color: category.color }}>
          {category.label}
        </span>
      </div>

      <div className={styles.scale} aria-label="Body fat range">
        {segments.map((segment) => {
          const width = ((segment.end - segment.start) / (domain.max - domain.min)) * 100
          return (
            <div
              key={`${segment.label}-${segment.start}`}
              className={styles.segment}
              style={{ width: `${width}%`, background: segment.color }}
              aria-hidden="true"
            />
          )
        })}
        <div
          className={styles.marker}
          style={{ left: `${markerRatio * 100}%` }}
          role="img"
          aria-label={`Body fat ${percentage.toFixed(1)}% (${category.label})`}
        />
      </div>

      <p className={styles.rangeText}>
        Based on Deurenberg's formula ({age} yrs, {sex === 'male' ? 'male' : 'female'}), with age-adjusted
        bands.
      </p>

      <ul className={styles.legend} aria-label="Body fat reference">
        {dynamicTable.map((item) => {
          const key = sex === 'female' ? 'female' : 'male'
          const range = item[key]
          const rangeText =
            range.max === Number.POSITIVE_INFINITY
              ? `${formatRangeValue(range.min)}+%`
              : `${formatRangeValue(range.min)}-${formatRangeValue(range.max)}%`
          return (
            <li key={item.label} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: item.color }} />
              <div className={styles.legendTextGroup}>
                <span className={styles.legendText}>{item.label}</span>
                <span className={styles.legendRange}>
                  {sex === 'male' ? 'Men' : 'Women'} {rangeText}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default BmiPill
