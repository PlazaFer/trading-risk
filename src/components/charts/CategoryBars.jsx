import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import useChartTheme from '../../hooks/useChartTheme.js'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * One metric across one dimension — hour of day, weekday, week, month.
 *
 * The same component renders P&L, win rate, trade count and average R
 * because the question is always the same shape: "which bucket of this
 * dimension is carrying me, and which one is bleeding?" Coloring by sign
 * rather than by category keeps that answer pre-attentive; a rainbow of
 * per-category colors would make it a puzzle.
 */
export default function CategoryBars({
  data = [],
  height = 240,
  format = (v) => v,
  // Axis ticks get their own formatter: "+$1,250.00" repeated down the left
  // edge is five times the ink of "$1.3k" for the same information.
  axisFormat,
  colorMode = 'sign',
  tooltipRows,
  showValues = false,
  emptyMessage = 'Sin datos',
}) {
  const c = useChartTheme()
  if (!data.length) {
    return (
      <div className="grid place-items-center text-xs text-ink-faint" style={{ height }}>
        {emptyMessage}
      </div>
    )
  }

  const colorOf = (d) => {
    if (colorMode === 'primary') return c.primary
    if (colorMode === 'accent') return c.accent
    return Number(d.value) >= 0 ? c.success : c.danger
  }

  const hasNegative = data.some((d) => Number(d.value) < 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: showValues ? 18 : 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={4}
        />
        <YAxis
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={axisFormat || format}
        />
        {hasNegative && <ReferenceLine y={0} stroke={c.line} />}
        <Tooltip
          cursor={{ fill: c.alpha('inkFaint', 0.07) }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <ChartTooltip
                title={d.title || d.label}
                rows={
                  tooltipRows
                    ? tooltipRows(d)
                    : [
                        {
                          label: 'Valor',
                          value: format(d.value),
                          className: d.value >= 0 ? 'text-success' : 'text-danger',
                        },
                      ]
                }
              />
            )
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={54}>
          {showValues && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={format}
              style={{ fill: c.inkFaint, fontSize: 10 }}
            />
          )}
          {data.map((d) => (
            <Cell key={d.key ?? d.label} fill={colorOf(d)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
