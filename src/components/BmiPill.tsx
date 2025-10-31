import styles from './BmiPill.module.css'

type BmiPillProps = {
  heightCm: number
  weightKg: number
}

const BMI_DOMAIN_MIN = 15
const BMI_DOMAIN_MAX = 35

const segments = [
  { label: 'Underweight', start: 15, end: 18.5, className: styles.segmentUnder },
  { label: 'Healthy', start: 18.5, end: 24.9, className: styles.segmentHealthy },
  { label: 'Overweight', start: 24.9, end: 29.9, className: styles.segmentOver },
  { label: 'Obese', start: 29.9, end: 35, className: styles.segmentObese },
]

const classify = (bmi: number) => {
  if (bmi < 18.5) {
    return { label: 'Underweight' }
  }
  if (bmi < 25) {
    return { label: 'Healthy' }
  }
  if (bmi < 30) {
    return { label: 'Overweight' }
  }
  return { label: 'Obese' }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const BmiPill = ({ heightCm, weightKg }: BmiPillProps) => {
  if (!heightCm || !weightKg) {
    return null
  }

  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  const formattedBmi = bmi.toFixed(1)
  const category = classify(bmi)
  const healthyMin = (18.5 * heightM * heightM).toFixed(1)
  const healthyMax = (24.9 * heightM * heightM).toFixed(1)

  const markerRatio =
    (clamp(bmi, BMI_DOMAIN_MIN, BMI_DOMAIN_MAX) - BMI_DOMAIN_MIN) /
    (BMI_DOMAIN_MAX - BMI_DOMAIN_MIN)

  return (
    <div className={styles.pill}>
      <div className={styles.topRow}>
        <span className={styles.label}>BMI</span>
        <span className={styles.value}>{formattedBmi}</span>
        <span className={styles.category}>{category.label}</span>
      </div>

      <div className={styles.scale}>
        {segments.map((segment) => {
          const width =
            ((segment.end - segment.start) / (BMI_DOMAIN_MAX - BMI_DOMAIN_MIN)) * 100
          return (
            <div
              key={segment.label}
              className={`${styles.segment} ${segment.className}`}
              style={{ width: `${width}%` }}
              aria-hidden="true"
            />
          )
        })}
        <div
          className={styles.marker}
          style={{ left: `${markerRatio * 100}%` }}
          role="img"
          aria-label={`BMI ${formattedBmi} (${category.label})`}
        />
      </div>

      <p className={styles.rangeText}>
        Healthy range for your height: {healthyMin}-{healthyMax} kg
      </p>
    </div>
  )
}

export default BmiPill
