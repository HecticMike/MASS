import type { Sex } from '../types/app'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const AGE_REFERENCE = 35
const DEURENBERG_AGE_FACTOR = 0.23

export const BODY_FAT_TABLE = [
  {
    label: 'Essential',
    male: { min: 2, max: 5 },
    female: { min: 10, max: 13 },
    color: '#0f79e6',
  },
  {
    label: 'Athletes',
    male: { min: 6, max: 13 },
    female: { min: 14, max: 20 },
    color: '#157a5a',
  },
  {
    label: 'Fit / healthy',
    male: { min: 14, max: 17 },
    female: { min: 21, max: 24 },
    color: '#3ba06d',
  },
  {
    label: 'Acceptable',
    male: { min: 18, max: 24 },
    female: { min: 25, max: 31 },
    color: '#efb21c',
  },
  {
    label: 'High',
    male: { min: 25, max: 29 },
    female: { min: 32, max: 37 },
    color: '#e54848',
  },
  {
    label: 'Very high',
    male: { min: 30, max: Number.POSITIVE_INFINITY },
    female: { min: 38, max: Number.POSITIVE_INFINITY },
    color: '#b42323',
  },
] as const

type Range = {
  min: number
  max: number
}

const FAT_DOMAIN = {
  male: { min: 0, max: 40 },
  female: { min: 5, max: 45 },
}

export const ageFromDob = (dob: string | undefined): number | null => {
  if (!dob) {
    return null
  }
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) {
    return null
  }
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}

export const targetBmiFor = (sex: Sex, ageYears: number | null): number => {
  const safeSex = sex === 'female' ? 'female' : 'male'
  const base = safeSex === 'male' ? 22.4 : 21.3
  const adj = ageYears ? clamp((ageYears - 35) * 0.025, -0.8, 1.4) : 0
  return clamp(base + adj, 19, 27)
}

export const bmiToKg = (bmi: number, heightCm: number): number => {
  if (!heightCm || heightCm <= 0) {
    return 0
  }
  const heightM = heightCm / 100
  return bmi * heightM * heightM
}

export const kgToBmi = (kg: number, heightCm: number): number => {
  if (!heightCm || heightCm <= 0) {
    return 0
  }
  const heightM = heightCm / 100
  return kg / (heightM * heightM)
}

export const bodyFatPercentage = (bmi: number, age: number, sex: Sex): number => {
  const sexFlag = sex === 'male' ? 1 : 0
  const estimate = 1.2 * bmi + 0.23 * age - 10.8 * sexFlag - 5.4
  return clamp(estimate, 2, 55)
}

const shiftRangeForAge = (range: Range, age: number): Range => {
  const shift = (age - AGE_REFERENCE) * DEURENBERG_AGE_FACTOR
  const min = Math.max(0, range.min + shift)
  if (!Number.isFinite(range.max)) {
    return { min, max: Number.POSITIVE_INFINITY }
  }
  return { min, max: Math.max(min, range.max + shift) }
}

export const bodyFatTableForAge = (age: number) =>
  BODY_FAT_TABLE.map((item) => ({
    ...item,
    male: shiftRangeForAge(item.male, age),
    female: shiftRangeForAge(item.female, age),
  }))

export const classifyBodyFat = (value: number, sex: Sex, age: number) => {
  const safeSex = sex === 'female' ? 'female' : 'male'
  const table = bodyFatTableForAge(age)
  return (
    table.find((item) => {
      const range = item[safeSex]
      return value >= range.min && value <= range.max
    }) ?? table[table.length - 1]
  )
}

export const bodyFatSegments = (sex: Sex, age: number) => {
  const key = sex === 'female' ? 'female' : 'male'
  const domain = bodyFatDomain(sex, age)
  const maxCap = domain.max
  return bodyFatTableForAge(age).map((item) => {
    const range = item[key]
    const start = clamp(range.min, domain.min, maxCap)
    const rangeEnd = Number.isFinite(range.max) ? range.max : maxCap
    const end = Math.max(start, clamp(rangeEnd, domain.min, maxCap))
    return {
      label: item.label,
      color: item.color,
      start,
      end,
    }
  })
}

export const bodyFatDomain = (sex: Sex, age?: number) => {
  const key = sex === 'female' ? 'female' : 'male'
  const base = FAT_DOMAIN[key]
  if (!age) {
    return base
  }
  const dynamic = bodyFatTableForAge(age)
  const lastRange = dynamic[dynamic.length - 1][key]
  const paddedMax = Math.ceil((lastRange.min + 5) / 5) * 5
  return {
    min: base.min,
    max: Math.max(base.max, paddedMax),
  }
}
