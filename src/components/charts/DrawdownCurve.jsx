import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import useChartTheme from '../../hooks/useChartTheme.js'
import { compactMoney, money, percent } from '../../lib/format.js'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * The underwater curve: distance below the previous equity peak, always
 * zero or negative.
 *
 * The equity curve shows what you made; this shows what it cost to sit
 * through. Time spent at the bottom of a trough is the variable that decides
 * whether a trader abandons a working system, and it is only legible here —
 * on an equity chart a long flat recovery looks like nothing happening.
 */
export default function DrawdownCurve({ points = [], height = 260 }) {
  const c = useChartTheme()
  if (points.length < 2) return null

  const worst = Math.min(...points.map((p) => p.drawdown))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.danger} stopOpacity={0.05} />
            <stop offset="100%" stopColor={c.danger} stopOpacity={0.35} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={[Math.min(worst * 1.15, -1), 0]}
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={compactMoney}
        />
        <Tooltip
          cursor={{ stroke: c.inkFaint, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <ChartTooltip
                title={d.trade ? `Trade ${d.label} · ${d.date || ''}` : 'Inicio'}
                rows={[
                  {
                    label: 'Bajo el pico',
                    value: d.drawdown ? money(d.drawdown) : 'En máximos',
                    className: d.drawdown ? 'text-danger' : 'text-success',
                  },
                  { label: 'Caída', value: percent(d.drawdownPct) },
                  { label: 'Equity', value: money(d.equity) },
                ]}
              />
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke={c.danger}
          strokeWidth={1.75}
          fill="url(#ddFill)"
          dot={false}
          activeDot={{ r: 4, fill: c.danger, stroke: c.bgCard, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
