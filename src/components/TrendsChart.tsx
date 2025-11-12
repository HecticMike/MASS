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

type TooltipProps = {
  active?: boolean
  payload?: Array<{
    payload: {
      kg: number
      time: number
      ts: string
      note?: string
    }
  }>
}

const COLORS = {
  entries: '#00a2ff',
  trend: '#37c38d',
  asymptote: '#ffd34d',
}

const MS_PER_DAY = 86_400_000

const TrendTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const datum = payload[0]!.payload
  return (
    <div
      style={{
        background: 'var(--surface)',
        padding: '0.65rem 0.85rem',
        border: '1.5px solid var(--border-strong)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ fontWeight: 600 }}>{format(datum.ts)}</div>
      <div style={{ fontSize: '0.9rem' }}>{datum.kg.toFixed(1)} kg</div>
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
  } = useMemo(() => {
    if (baseData.length < 2) {
      return {
        trendData: [] as Array<{ time: number; trend: number }>,
        asymptoteData: null as Array<{ time: number; asymptote: number }> | null,
        domainX: undefined,
        domainY: undefined,
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
    const trend = smooth.map((point) => ({
      time: minTime + point.x * MS_PER_DAY,
      trend: point.y,
    }))

    const asymptoteFit = fitAsymptote(normalizedPoints, sampleXs)
    const asymptote =
      asymptoteFit?.points.map((point) => ({
        time: minTime + point.x * MS_PER_DAY,
        asymptote: point.y,
      })) ?? null

    return {
      trendData: trend,
      asymptoteData: asymptote,
      domainX: [minTime, maxTime] as [number, number],
      domainY: [
        Math.floor((minKg - 1) * 10) / 10,
        Math.ceil((maxKg + 1) * 10) / 10,
      ] as [number, number],
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
              tickCount={5}
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
