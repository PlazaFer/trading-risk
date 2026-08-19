import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import useChartTheme from '../../hooks/useChartTheme.js'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * Histogram of R-multiples.
 *
 * The single most diagnostic chart in a journal: a healthy edge shows losses
 * clustered tightly around −1R (stops respected) and a right tail that runs.
 * Losses spilling past −2R mean the stop is a suggestion, not a rule.
 */
export default function RDistribution({ data, height = 220 }) {
  const c = useChartTheme()
  if (!data?.length) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: c.alpha('inkFaint', 0.08) }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <ChartTooltip
                title={`Entre ${d.bucket}R y ${d.bucket + 1}R`}
                rows={[{ label: 'Trades', value: d.count }]}
              />
            )
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={44}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.positive ? c.success : c.danger} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
