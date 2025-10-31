type Point = { x: number; y: number }

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
