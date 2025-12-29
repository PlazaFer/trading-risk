import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTrades } from '../context/TradesContext'

export default function MonthSelector() {
  const { selectedMonth, setSelectedMonth } = useTrades()

  const goToPreviousMonth = () => {
    setSelectedMonth(subMonths(selectedMonth, 1))
  }

  const goToNextMonth = () => {
    setSelectedMonth(addMonths(selectedMonth, 1))
  }

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date())
  }

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goToPreviousMonth}
        className="p-2 rounded-lg bg-background-secondary border border-border hover:border-primary/50 transition-colors"
        title="Mes anterior"
      >
        <ChevronLeft className="w-4 h-4 text-text-secondary" />
      </button>

      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-secondary border border-border min-w-[160px] justify-center">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-medium text-text capitalize">
          {format(selectedMonth, 'MMMM yyyy', { locale: es })}
        </span>
      </div>

      <button
        onClick={goToNextMonth}
        className="p-2 rounded-lg bg-background-secondary border border-border hover:border-primary/50 transition-colors"
        title="Mes siguiente"
      >
        <ChevronRight className="w-4 h-4 text-text-secondary" />
      </button>

      {!isCurrentMonth && (
        <button
          onClick={goToCurrentMonth}
          className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
        >
          Hoy
        </button>
      )}
    </div>
  )
}

