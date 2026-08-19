import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import useChartTheme from '../../hooks/useChartTheme.js'
import { buildEquityCurve } from '../../lib/calc.js'
import { compactMoney, money, pnl } from '../../lib/format.js'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * Trading equity after each closed trade.
 *
 * Deposits are deliberately excluded: an account that grew only because it
 * was funded should not look like an edge. The baseline is the starting
 * balance, so everything above the dashed line is money the strategy made.
 */
export default function EquityCurve({ trades, startingBalance = 0, height = 280, showAxis = true }) {
  const c = useChartTheme()
  const data = useMemo(
    () => buildEquityCurve(trades, { startingBalance }),
    [trades, startingBalance]
  )

  if (data.length < 2) return null

  const last = data[data.length - 1]
  const up = last.equity >= startingBalance
  const stroke = up ? c.success : c.danger

  const values = data.map((d) => d.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.12, Math.abs(max) * 0.01, 1)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: showAxis ? 4 : 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {showAxis && <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />}

        <XAxis
          dataKey="index"
          hide={!showAxis}
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v === 0 ? '' : `#${v}`)}
          minTickGap={28}
        />
        <YAxis
          hide={!showAxis}
          domain={[min - pad, max + pad]}
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={compactMoney}
        />

        <ReferenceLine
          y={startingBalance}
          stroke={c.inkFaint}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />

        <Tooltip
          cursor={{ stroke: c.inkFaint, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            if (!d.trade) {
              return <ChartTooltip title="Balance inicial" rows={[{ label: 'Equity', value: money(d.equity) }]} />
            }
            return (
              <ChartTooltip
                title={`Trade #${d.index} · ${d.trade.symbol} ${d.trade.direction}`}
                rows={[
                  {
                    label: 'Resultado',
                    value: pnl(d.pnl),
                    className: d.pnl >= 0 ? 'text-success' : 'text-danger',
                  },
                  { label: 'Equity', value: money(d.equity) },
                  {
                    label: 'Acumulado',
                    value: pnl(d.cumulative),
                    className: d.cumulative >= 0 ? 'text-success' : 'text-danger',
                  },
                ]}
                footer={d.date}
              />
            )
          }}
        />

        <Area
          type="monotone"
          dataKey="equity"
          stroke={stroke}
          strokeWidth={2}
          fill="url(#equityFill)"
          dot={false}
          activeDot={{ r: 4, fill: stroke, stroke: c.bgCard, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
