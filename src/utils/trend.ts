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

const fitExponential = (entries: Array<{ ts: string; kg: number }>): ExponentialFit | null => {
  const points = entries
    .filter((entry) => entry && typeof entry.ts === 'string' && typeof entry.kg === 'number')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  if (points.length < 4) {
    return null
  }

  const baseTime = new Date(points[0]!.ts).getTime()
  const xs = points.map((entry, index) => {
    const time = new Date(entry.ts).getTime()
    return (time - baseTime) / MS_PER_DAY + index * 1e-6
  })
  const ys = points.map((entry) => entry.kg)
  const w0 = ys[0]!
  const minY = Math.min(...ys)

  const floors: number[] = []
  const lower = minY - 2
  const upper = minY - 0.3
  if (upper <= lower) {
    return null
  }
  const steps = 40
  for (let i = 0; i <= steps; i += 1) {
    floors.push(lower + ((upper - lower) * i) / steps)
  }

  const meanY = ys.reduce((acc, value) => acc + value, 0) / ys.length
  const sst = ys.reduce((acc, value) => acc + (value - meanY) ** 2, 0) || 1

  let best: ExponentialFit | null = null
  let bestR2 = 0

  for (const floor of floors) {
    if (w0 <= floor + 0.2) {
      continue
    }
    if (ys.some((value) => value <= floor + 0.05)) {
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
    const sse = ys.reduce((acc, value, index) => acc + (value - predictions[index]!) ** 2, 0)
    const r2 = 1 - sse / sst
    if (r2 > bestR2 && Number.isFinite(r2)) {
      bestR2 = r2
      best = {
        floor,
        intercept: regression.intercept,
        k,
        baseTime,
        r2,
      }
    }
  }

  if (!best || best.r2 < 0.55) {
    return null
  }

  return best
}

export type WeeklyForecast = {
  date: string
  kg: number
  dayOffset: number
}

export const forecastWeeklyWeights = (
  entries: Array<{ ts: string; kg: number }>,
  weeks = 4,
): WeeklyForecast[] | null => {
  const points = entries
    .filter((entry) => entry && typeof entry.ts === 'string' && typeof entry.kg === 'number')
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  if (points.length < 2) {
    return null
  }
  const latestKg = points[points.length - 1]!.kg

  const clampPrediction = (value: number) => {
    const min = latestKg - 2.5
    const max = latestKg + 1.5
    return Math.max(min, Math.min(max, value))
  }
  const fit = fitExponential(points)
  if (fit) {
    const lastTime = new Date(points[points.length - 1]!.ts).getTime()
    const lastT = (lastTime - fit.baseTime) / MS_PER_DAY
    const forecasts: WeeklyForecast[] = []
    for (let week = 1; week <= weeks; week += 1) {
      const dayOffset = week * 7
      const t = lastT + dayOffset
      const kg = clampPrediction(fit.floor + Math.exp(fit.intercept - fit.k * t))
      const date = new Date(lastTime + dayOffset * MS_PER_DAY).toISOString()
      forecasts.push({ date, kg, dayOffset })
    }
    return forecasts
  }

  const baseTime = new Date(points[0]!.ts).getTime()
  const xs = points.map((entry, index) => {
    const time = new Date(entry.ts).getTime()
    return (time - baseTime) / MS_PER_DAY + index * 1e-6
  })
  const ys = points.map((entry) => entry.kg)
  const regression = linearRegression(xs, ys)
  if (!regression) {
    return null
  }
  const limitedSlope = Math.max(-0.2, Math.min(0.2, regression.slope))
  const lastTime = new Date(points[points.length - 1]!.ts).getTime()
  const lastX = xs[xs.length - 1]!
  const forecasts: WeeklyForecast[] = []
  for (let week = 1; week <= weeks; week += 1) {
    const dayOffset = week * 7
    const futureX = lastX + dayOffset
    const kg = clampPrediction(regression.intercept + limitedSlope * futureX)
    const date = new Date(lastTime + dayOffset * MS_PER_DAY).toISOString()
    forecasts.push({ date, kg, dayOffset })
  }
  return forecasts
}
