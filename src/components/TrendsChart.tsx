import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Entry } from '../types/app'
import { format } from '../utils/date'
import { fitAsymptote, loessSmooth } from '../utils/trend'
import styles from './TrendsChart.module.css'

type TrendsChartProps = {
  entries: Entry[]
  unit: 'kg' | 'lb'
}

type TooltipPayloadItem = {
  payload: {
    kg?: number
    trend?: number
    asymptote?: number
    time?: number
    ts?: string
    note?: string
  }
}

const COLORS = {
  entries: '#00a2ff',
  trend: '#37c38d',
  asymptote: '#ffd34d',
}

const MS_PER_DAY = 86_400_000

const niceTickStep = (rawStep: number): number => {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 0.5
  }

  const exponent = Math.floor(Math.log10(rawStep))
  const fraction = rawStep / 10 ** exponent
  let niceFraction: number

  if (fraction < 1.5) {
    niceFraction = 1
  } else if (fraction < 3) {
    niceFraction = 2
  } else if (fraction < 7) {
    niceFraction = 5
  } else {
    niceFraction = 10
  }

  return niceFraction * 10 ** exponent
}

const normalizeTickValue = (value: number) => Number(value.toFixed(1))

const TrendTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const datumSource = payload
    .map((item) => item.payload)
    .find(
      (candidate) =>
        typeof candidate.kg === 'number' ||
        typeof candidate.trend === 'number' ||
        typeof candidate.asymptote === 'number',
    )
  const datum = datumSource ?? payload[0]!.payload

  const weightValue =
    typeof datum.kg === 'number'
      ? datum.kg
      : typeof datum.trend === 'number'
      ? datum.trend
      : typeof datum.asymptote === 'number'
      ? datum.asymptote
      : null

  if (weightValue === null) {
    return null
  }

  const timestamp =
    datum.ts ?? (typeof datum.time === 'number' ? new Date(datum.time).toISOString() : undefined)

  if (!timestamp) {
    return null
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        padding: '0.65rem 0.85rem',
        border: '1.5px solid var(--border-strong)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ fontWeight: 600 }}>{format(timestamp)}</div>
      <div style={{ fontSize: '0.9rem' }}>{weightValue.toFixed(1)} kg</div>
      {datum.note ? <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{datum.note}</div> : null}
    </div>
  )
}

const TrendsChart = ({ entries, unit }: TrendsChartProps) => {
  const [showTrend, setShowTrend] = useState(true)

  const baseData = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map((entry) => {
        const date = new Date(entry.ts)
        return {
          time: date.getTime(),
          kg: entry.kg,
          ts: entry.ts,
          note: entry.note,
        }
      })
  }, [entries])

  const {
    trendData,
    asymptoteData,
    domainX,
    domainY,
    yTicks,
  } = useMemo(() => {
    if (baseData.length < 2) {
      return {
        trendData: [] as Array<{ time: number; trend: number }>,
        asymptoteData: null as Array<{ time: number; asymptote: number }> | null,
        domainX: undefined,
        domainY: undefined,
        yTicks: undefined,
      }
    }

    const minTime = baseData[0]!.time
    const maxTime = baseData[baseData.length - 1]!.time
    const minKg = baseData.reduce((acc, item) => Math.min(acc, item.kg), Infinity)
    const maxKg = baseData.reduce((acc, item) => Math.max(acc, item.kg), -Infinity)

    const normalizedPoints = baseData.map((item) => ({
      x: (item.time - minTime) / MS_PER_DAY,
      y: item.kg,
    }))

    const minX = normalizedPoints[0]!.x
    const maxX = normalizedPoints[normalizedPoints.length - 1]!.x
    const samples = Math.max(50, Math.min(240, normalizedPoints.length * 8))
    const sampleXs =
      maxX - minX === 0
        ? normalizedPoints.map((point) => point.x)
        : Array.from({ length: samples }, (_, index) => minX + ((maxX - minX) * index) / (samples - 1))

    const smooth = loessSmooth(normalizedPoints, 0.3, sampleXs)
    const trend = smooth.map((point) => {
      const time = minTime + point.x * MS_PER_DAY
      return {
        time,
        ts: new Date(time).toISOString(),
        trend: point.y,
      }
    })

    const asymptoteFit = fitAsymptote(normalizedPoints, sampleXs)
    const asymptote =
      asymptoteFit?.points.map((point) => {
        const time = minTime + point.x * MS_PER_DAY
        return {
          time,
          ts: new Date(time).toISOString(),
          asymptote: point.y,
        }
      }) ?? null

    const axisMin = Math.floor((minKg - 1) * 10) / 10
    const axisMaxCandidate = Math.ceil((maxKg + 1) * 10) / 10
    const axisMax = axisMaxCandidate > axisMin ? axisMaxCandidate : axisMin + 0.2
    const axisRange = Math.max(0.2, axisMax - axisMin)
    const targetTicks = 5
    const rawStep = axisRange / Math.max(targetTicks - 1, 1)
    const step = niceTickStep(rawStep)
    const safeStep = step > 0 ? step : 0.5
    const niceMin = Math.floor(axisMin / safeStep) * safeStep
    const niceMax = Math.ceil(axisMax / safeStep) * safeStep
    const tickValues = new Set<number>()
    for (let tick = niceMin; tick <= niceMax + safeStep / 2; tick += safeStep) {
      tickValues.add(normalizeTickValue(tick))
    }
    tickValues.add(normalizeTickValue(niceMin))
    tickValues.add(normalizeTickValue(niceMax))
    const yTicks = Array.from(tickValues).sort((a, b) => a - b)

    return {
      trendData: trend,
      asymptoteData: asymptote,
      domainX: [minTime, maxTime] as [number, number],
      domainY: [niceMin, niceMax] as [number, number],
      yTicks,
    }
  }, [baseData])

  if (baseData.length < 2) {
    return <p className={styles.placeholder}>Add a couple of logs to unlock your weight trend.</p>
  }

  const tickFormatter = (value: number) => format(new Date(value).toISOString())

  return (
    <div className={styles.chart}>
      <div className={styles.legend}>
        <div className={styles.swatch} style={{ background: COLORS.entries }} />
        <span>Entries</span>
        <button
          type="button"
          className={`${styles.toggle} ${showTrend ? '' : styles.toggleInactive}`}
          onClick={() => setShowTrend((prev) => !prev)}
          aria-pressed={showTrend}
        >
          <span
            className={styles.swatch}
            style={{ background: COLORS.trend }}
          />
          Smooth trend
        </button>
      </div>
      <div className={styles.panel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={baseData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              dataKey="time"
              type="number"
              domain={domainX}
              tickFormatter={tickFormatter}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey="kg"
              type="number"
              domain={domainY}
              tickFormatter={(value) => `${value.toFixed(1)} kg`}
              ticks={yTicks}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<TrendTooltip />} />
            <Scatter
              name="Entries"
              data={baseData}
              dataKey="kg"
              fill={COLORS.entries}
              shape="circle"
            />
            {showTrend ? (
              <Line
                name="Trend"
                type="monotone"
                data={trendData}
                dataKey="trend"
                stroke={COLORS.trend}
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            {asymptoteData ? (
              <Line
                name="Asymptote"
                type="monotone"
                data={asymptoteData}
                dataKey="asymptote"
                stroke={COLORS.asymptote}
                strokeWidth={2}
                strokeDasharray="5 6"
                dot={false}
                opacity={0.35}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {unit !== 'kg' ? (
        <small style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          Displayed weights are shown in kilograms.
        </small>
      ) : null}
    </div>
  )
}

export default TrendsChart
