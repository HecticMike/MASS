const KG_PER_LB = 0.45359237

export const roundTo = (value: number, decimals = 1) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export const toKg = (value: number, unit: 'kg' | 'lb') =>
  unit === 'kg' ? value : value * KG_PER_LB

export const fromKg = (kg: number, unit: 'kg' | 'lb') =>
  unit === 'kg' ? kg : kg / KG_PER_LB

export const kgFromInput = (value: number, unit: 'kg' | 'lb') => roundTo(toKg(value, unit))

export const formatWeight = (kg: number, unit: 'kg' | 'lb') => {
  const converted = fromKg(kg, unit)
  const decimals = unit === 'kg' ? 1 : 1
  return `${roundTo(converted, decimals).toFixed(decimals)} ${unit}`
}
