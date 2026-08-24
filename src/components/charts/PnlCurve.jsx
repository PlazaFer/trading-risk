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
import { compactMoney, money, percent, pnl } from '../../lib/format.js'
import ChartTooltip from './ChartTooltip.jsx'

/**
 * The headline chart: cumulative result over time, at whichever resolution
 * the trader picked.
 *
 * Plots accumulated P&L rather than account equity, with zero as the
 * baseline. On a funded account the equity view compresses everything into a
 * flat line near the balance — $1.4k of work on $50k is three pixels of
 * movement. Anchoring at zero gives the actual performance the full canvas,
 * and the balance is shown as a number in the header where it belongs.
 */
export default function PnlCurve({ data = [], startingBalance = 0, height = 300 }) {
  const c = useChartTheme()
  if (data.length < 2) return null

  const last = data[data.length - 1]
  const up = last.cumulative >= 0
  const stroke = up ? c.success : c.danger

  const values = data.map((d) => d.cumulative)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const pad = Math.max((max - min) * 0.12, 1)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="pnlCurveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke={c.line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tick={{ fill: c.inkFaint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={58}
          tickFormatter={compactMoney}
        />
        <ReferenceLine y={0} stroke={c.inkFaint} strokeDasharray="4 4" strokeOpacity={0.55} />

        <Tooltip
          cursor={{ stroke: c.inkFaint, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            if (!d.count) {
              return (
                <ChartTooltip
                  title="Punto de partida"
                  rows={[{ label: 'Balance', value: money(startingBalance) }]}
                />
              )
            }
            const rows = [
              {
                label: d.trade ? 'Resultado' : 'Resultado del período',
                value: pnl(d.pnl),
                className: d.pnl >= 0 ? 'text-success' : 'text-danger',
              },
              {
                label: 'Acumulado',
                value: pnl(d.cumulative),
                className: d.cumulative >= 0 ? 'text-success' : 'text-danger',
              },
              { label: 'Balance', value: money(d.equity) },
            ]
            if (!d.trade) {
              rows.splice(1, 0, {
                label: 'Trades',
                value: `${d.count} · ${percent((d.wins / d.count) * 100, { decimals: 0 })} WR`,
              })
            }
            return (
              <ChartTooltip
                title={
                  d.trade
                    ? `${d.label} · ${d.trade.symbol} ${d.trade.direction}`
                    : d.label
                }
                rows={rows}
                footer={d.trade ? d.date : undefined}
              />
            )
          }}
        />

        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={stroke}
          strokeWidth={2}
          fill="url(#pnlCurveFill)"
          dot={false}
          activeDot={{ r: 4, fill: stroke, stroke: c.bgCard, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
