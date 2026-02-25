type Point = { x: number; y: number }

const MS_PER_DAY = 86_400_000

const tricube = (t: number) => {
  const absT = Math.abs(t)
  if (absT >= 1) {
    return 0
  }
  const tmp = 1 - absT ** 3
  return tmp ** 3
}

export const loessSmooth = (
  points: Point[],
  span = 0.3,
  sampleXs?: number[],
): Point[] => {
  if (points.length === 0) {
    return []
  }

  const sorted = [...points].sort((a, b) => a.x - b.x)
  const n = sorted.length
  const bandwidth = Math.max(2, Math.floor(span * n))
  const xs =
    sampleXs ??
    sorted.map((point) => point.x)

  const distancesBuffer = new Array(n)

  const estimate = (x: number) => {
    for (let i = 0; i < n; i += 1) {
      distancesBuffer[i] = Math.abs(sorted[i].x - x)
    }
    const sortedDistances = [...distancesBuffer].sort((a, b) => a - b)
    const bandwidthIndex = Math.min(n - 1, bandwidth)
    const maxDistance = sortedDistances[bandwidthIndex] ?? sortedDistances[sortedDistances.length - 1]

    if (!maxDistance || maxDistance === 0) {
      const exact = sorted.find((point) => point.x === x)
      return exact?.y ?? sorted[0].y
    }

    let S0 = 0
    let S1 = 0
    let S2 = 0
    let SY = 0
    let SXY = 0

    for (let i = 0; i < n; i += 1) {
      const point = sorted[i]
      const w = tricube(distancesBuffer[i] / maxDistance)
      if (w === 0) {
        continue
      }
      const xi = point.x
      const yi = point.y
      S0 += w
      S1 += w * xi
      S2 += w * xi * xi
      SY += w * yi
      SXY += w * xi * yi
    }

    const denominator = S0 * S2 - S1 * S1
    if (denominator === 0 || S0 === 0) {
      return SY / (S0 || 1)
    }

    const slope = (S0 * SXY - S1 * SY) / denominator
    const intercept = (SY - slope * S1) / S0
    return intercept + slope * x
  }

  return xs.map((x) => ({
    x,
    y: estimate(x),
  }))
}

type AsymptoteResult = {
  points: Point[]
  r2: number
}

const linearRegression = (x: number[], y: number[]) => {
  const n = x.length
  const sumX = x.reduce((acc, value) => acc + value, 0)
  const sumY = y.reduce((acc, value) => acc + value, 0)
  const sumXY = x.reduce((acc, value, index) => acc + value * y[index]!, 0)
  const sumX2 = x.reduce((acc, value) => acc + value * value, 0)
  const denominator = n * sumX2 - sumX * sumX

  if (denominator === 0) {
    return null
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export const fitAsymptote = (
  points: Point[],
  sampleXs: number[],
): AsymptoteResult | null => {
  const n = points.length
  if (n < 5) {
    return null
  }

  const recent = points.slice(-Math.min(points.length, 12))
  const minY = recent.reduce((acc, point) => Math.min(acc, point.y), Number.POSITIVE_INFINITY)

  const floors: number[] = []
  const minFloor = minY - 6
  const maxFloor = minY - 0.5
  const steps = 40
  for (let i = 0; i <= steps; i += 1) {
    const floorCandidate = minFloor + ((maxFloor - minFloor) * i) / steps
    floors.push(floorCandidate)
  }

  let best: AsymptoteResult | null = null
  let bestR2 = 0

  const baseX = recent[0]!.x
  const xValues = recent.map((point, index) => point.x - baseX + index * 1e-6)
  const yValues = recent.map((point) => point.y)
  const meanY = yValues.reduce((acc, value) => acc + value, 0) / yValues.length
  const sst = yValues.reduce((acc, value) => acc + (value - meanY) ** 2, 0)

  for (const floor of floors) {
    if (yValues.some((value) => value <= floor + 0.05)) {
      continue
    }

    const transformed = yValues.map((value) => Math.log(value - floor))
    const regression = linearRegression(xValues, transformed)
    if (!regression) {
      continue
    }

    const { slope, intercept } = regression
    const k = -slope
    if (k <= 0) {
      continue
    }

    const predictions = xValues.map((value) => floor + Math.exp(intercept - k * value))
    const sse = yValues.reduce(
      (acc, value, index) => acc + (value - predictions[index]!) ** 2,
      0,
    )
    const r2 = 1 - sse / (sst || 1)

    if (Number.isFinite(r2) && r2 > bestR2) {
      bestR2 = r2
      best = {
        points: sampleXs.map((sampleX) => ({
          x: sampleX,
          y: floor + Math.exp(intercept - k * (sampleX - baseX)),
        })),
        r2,
      }
    }
  }

  if (!best || bestR2 <= 0.6) {
    return null
  }

  return best
}

type ExponentialFit = {
  floor: number
  intercept: number
  k: number
  baseTime: number
  r2: number
}

/**
 * Select recent entries for forecasting.
 * Uses a 45-day window, extending to 90 days if too few points.
 */
const selectRecentEntries = (
  sorted: Array<{ ts: string; kg: number }>,
  windowDays = 45,
  extendedDays = 90,
  minPoints = 6,
): Array<{ ts: string; kg: number }> => {
  const latestMs = new Date(sorted[sorted.length - 1]!.ts).getTime()
  const cutoff = latestMs - windowDays * MS_PER_DAY
  let recent = sorted.filter((e) => new Date(e.ts).getTime() >= cutoff)
  if (recent.length < minPoints) {
    const extCutoff = latestMs - extendedDays * MS_PER_DAY
    recent = sorted.filter((e) => new Date(e.ts).getTime() >= extCutoff)
  }
  if (recent.length < minPoints) {
    recent = sorted.slice(-Math.min(sorted.length, minPoints * 3))
  }
  return recent
}

/**
 * Collapse multiple weigh-ins per calendar day into a single average.
 */
const dailyAverage = (
  entries: Array<{ ts: string; kg: number }>,
): Array<{ ts: string; kg: number }> => {
  const buckets = new Map<string, { sum: number; count: number; ts: string }>()
  for (const entry of entries) {
    const day = entry.ts.slice(0, 10)
    const existing = buckets.get(day)
    if (existing) {
      existing.sum += entry.kg
      existing.count += 1
    } else {
      buckets.set(day, { sum: entry.kg, count: 1, ts: entry.ts })
    }
  }
  return Array.from(buckets.values())
    .map((b) => ({ ts: b.ts, kg: b.sum / b.count }))
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
}

const fitExponential = (
  entries: Array<{ ts: string; kg: number }>,
): ExponentialFit | null => {
  const averaged = dailyAverage(entries)
  if (averaged.length < 5) {
    return null
  }

  const baseTime = new Date(averaged[0]!.ts).getTime()
  const xs = averaged.map((e) => (new Date(e.ts).getTime() - baseTime) / MS_PER_DAY)
  const ys = averaged.map((e) => e.kg)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const range = maxY - minY

  if (range < 0.4) {
    return null
  }

  const floors: number[] = []
  const lower = minY - Math.max(range * 2, 6)
  const upper = minY - 0.2
  if (upper <= lower) {
    return null
  }
  const steps = 50
  for (let i = 0; i <= steps; i += 1) {
    floors.push(lower + ((upper - lower) * i) / steps)
  }

  const meanY = ys.reduce((acc, v) => acc + v, 0) / ys.length
  const sst = ys.reduce((acc, v) => acc + (v - meanY) ** 2, 0) || 1

  let best: ExponentialFit | null = null
  let bestR2 = 0

  for (const floor of floors) {
    if (ys.some((v) => v <= floor + 0.01)) {
      continue
    }

    const transformed: number[] = []
    let valid = true
    for (const y of ys) {
      const diff = y - floor
      if (diff <= 0) {
        valid = false
        break
      }
      transformed.push(Math.log(diff))
    }
    if (!valid) {
      continue
    }

    const regression = linearRegression(xs, transformed)
    if (!regression || regression.slope >= 0) {
      continue
    }
    const k = -regression.slope
    const predictions = xs.map((x) => floor + Math.exp(regression.intercept - k * x))
    const sse = ys.reduce((acc, v, i) => acc + (v - predictions[i]!) ** 2, 0)
    const r2 = 1 - sse / sst
    if (r2 > bestR2 && Number.isFinite(r2)) {
      bestR2 = r2
      best = { floor, intercept: regression.intercept, k, baseTime, r2 }
    }
  }

  if (!best || best.r2 < 0.65) {
    return null
  }
  return best
}

/**
 * Recency-weighted linear regression — recent points matter more.
 * halfLife is in the same unit as x (days).
 */
const weightedLinearRegression = (
  x: number[],
  y: number[],
  halfLife = 21,
) => {
  const n = x.length
  if (n < 2) return null
  const maxX = x[n - 1]!
  const lambda = Math.LN2 / halfLife

  let wS = 0
  let wX = 0
  let wY = 0
  let wXY = 0
  let wX2 = 0

  for (let i = 0; i < n; i++) {
    const w = Math.exp(-lambda * (maxX - x[i]!))
    wS += w
    wX += w * x[i]!
    wY += w * y[i]!
    wXY += w * x[i]! * y[i]!
    wX2 += w * x[i]! * x[i]!
  }

  const denom = wS * wX2 - wX * wX
  if (denom === 0) return null
  const slope = (wS * wXY - wX * wY) / denom
  const intercept = (wY - slope * wX) / wS

  const wMeanY = wY / wS
  let sst = 0
  let sse = 0
  for (let i = 0; i < n; i++) {
    const w = Math.exp(-lambda * (maxX - x[i]!))
    sst += w * (y[i]! - wMeanY) ** 2
    sse += w * (y[i]! - (intercept + slope * x[i]!)) ** 2
  }
  const r2 = sst > 0 ? 1 - sse / sst : 0

  return { slope, intercept, r2 }
}

export type ForecastModel = 'exponential' | 'linear'

export type WeeklyForecast = {
  date: string
  kg: number
  dayOffset: number
}

export type ForecastResult = {
  model: ForecastModel
  r2: number
  forecasts: WeeklyForecast[]
}

export const forecastWeeklyWeights = (
  entries: Array<{ ts: string; kg: number }>,
  weeks = 4,
): ForecastResult | null => {
  const sorted = entries
    .filter((e) => e && typeof e.ts === 'string' && typeof e.kg === 'number')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  if (sorted.length < 3) {
    return null
  }

  const recent = selectRecentEntries(sorted)
  const latestKg = sorted[sorted.length - 1]!.kg
  const lastTime = new Date(sorted[sorted.length - 1]!.ts).getTime()

  // Adaptive clamp based on recent data range
  const recentKgs = recent.map((e) => e.kg)
  const recentRange = Math.max(...recentKgs) - Math.min(...recentKgs)
  const maxWeeklyDelta = Math.max(recentRange / 2, 0.8)
  const clamp = (value: number, week: number) => {
    const maxDrift = maxWeeklyDelta * week
    return Math.max(latestKg - maxDrift, Math.min(latestKg + maxDrift, value))
  }

  // 1. Try exponential fit on the recent window
  const fit = fitExponential(recent)
  if (fit) {
    const lastT = (lastTime - fit.baseTime) / MS_PER_DAY
    const forecasts: WeeklyForecast[] = []
    for (let w = 1; w <= weeks; w += 1) {
      const dayOffset = w * 7
      const t = lastT + dayOffset
      const kg = clamp(fit.floor + Math.exp(fit.intercept - fit.k * t), w)
      const date = new Date(lastTime + dayOffset * MS_PER_DAY).toISOString()
      forecasts.push({ date, kg, dayOffset })
    }
    return { model: 'exponential', r2: fit.r2, forecasts }
  }

  // 2. Fall back to recency-weighted linear regression
  const averaged = dailyAverage(recent)
  if (averaged.length < 2) {
    return null
  }
  const baseTime = new Date(averaged[0]!.ts).getTime()
  const xs = averaged.map((e) => (new Date(e.ts).getTime() - baseTime) / MS_PER_DAY)
  const ys = averaged.map((e) => e.kg)
  const regression = weightedLinearRegression(xs, ys)
  if (!regression) {
    return null
  }

  // Cap slope at ±0.15 kg/day (~1 kg/week)
  const limitedSlope = Math.max(-0.15, Math.min(0.15, regression.slope))
  const lastX = (lastTime - baseTime) / MS_PER_DAY
  const forecasts: WeeklyForecast[] = []
  for (let w = 1; w <= weeks; w += 1) {
    const dayOffset = w * 7
    const futureX = lastX + dayOffset
    const kg = clamp(regression.intercept + limitedSlope * futureX, w)
    const date = new Date(lastTime + dayOffset * MS_PER_DAY).toISOString()
    forecasts.push({ date, kg, dayOffset })
  }
  return { model: 'linear', r2: regression.r2, forecasts }
}
