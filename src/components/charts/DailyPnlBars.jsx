import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import useChartTheme from '../../hooks/useChartTheme.js'
import { compactMoney, pnl, pnlText } from '../../lib/format.js'
import { dateFromKey } from '../../lib/time.js'
import ChartTooltip from './ChartTooltip.jsx'

/** Net P&L per trading day. The shape of consistency, or the lack of it. */
export default function DailyPnlBars({ data, height = 240 }) {
  const c = useChartTheme()
  if (!data?.length) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          tickFormatter={(v) => {
            const d = dateFromKey(v)
            return d ? `${d.getDate()}/${d.getMonth() + 1}` : v
          }}
        />
        <YAxis
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={compactMoney}
        />
        <ReferenceLine y={0} stroke={c.line} />
        <Tooltip
          cursor={{ fill: c.alpha('inkFaint', 0.08) }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <ChartTooltip
                title={d.day}
                rows={[
                  {
                    label: 'P&L del día',
                    value: pnl(d.netPnl),
                    className: pnlText(d.netPnl),
                  },
                  {
                    label: 'Trades',
                    // Spelled out rather than "wins vs. the rest": lumping the
                    // breakeven trades in with the losers is exactly the
                    // arithmetic this journal should not do.
                    value: `${d.wins}G · ${d.losses ?? d.count - d.wins}P${
                      d.breakeven ? ` · ${d.breakeven}BE` : ''
                    }`,
                  },
                  { label: 'Acumulado', value: pnl(d.cumulative) },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="netPnl" radius={[3, 3, 0, 0]} maxBarSize={26}>
          {data.map((d) => (
            <Cell
              key={d.day}
              fill={d.netPnl > 0 ? c.success : d.netPnl < 0 ? c.danger : c.warning}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
