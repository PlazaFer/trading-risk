import { useMemo } from 'react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { format, parseISO } from 'date-fns'

export default function StatsChart({ trades, startingBalance = 0, mini = false }) {
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return []

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    )

    let runningBalance = startingBalance
    
    return sortedTrades.map(trade => {
      runningBalance += trade.final_result
      return {
        date: trade.date,
        balance: runningBalance,
        result: trade.final_result,
        pair: trade.pair,
      }
    })
  }, [trades, startingBalance])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        Sin datos para mostrar
      </div>
    )
  }

  const minBalance = Math.min(startingBalance, ...chartData.map(d => d.balance))
  const maxBalance = Math.max(startingBalance, ...chartData.map(d => d.balance))
  const isProfit = chartData[chartData.length - 1]?.balance >= startingBalance

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-text-secondary text-xs mb-1">
            {format(parseISO(data.date), 'dd/MM/yyyy')}
          </p>
          <p className="text-text font-medium">
            Balance: ${data.balance.toFixed(2)}
          </p>
          <p className={`text-sm ${data.result >= 0 ? 'text-success' : 'text-danger'}`}>
            {data.result >= 0 ? '+' : ''}{data.result.toFixed(2)} ({data.pair})
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
            <stop 
              offset="5%" 
              stopColor={isProfit ? 'var(--color-success)' : 'var(--color-danger)'} 
              stopOpacity={0.3}
            />
            <stop 
              offset="95%" 
              stopColor={isProfit ? 'var(--color-success)' : 'var(--color-danger)'} 
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        
        {!mini && (
          <>
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => format(parseISO(date), 'dd/MM')}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis 
              domain={[minBalance * 0.98, maxBalance * 1.02]}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
          </>
        )}
        
        <Tooltip content={<CustomTooltip />} />
        
        <Area
          type="monotone"
          dataKey="balance"
          stroke={isProfit ? 'var(--color-success)' : 'var(--color-danger)'}
          strokeWidth={2}
          fill="url(#colorBalance)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
