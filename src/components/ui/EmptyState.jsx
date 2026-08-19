export default function EmptyState({ icon: Icon, title, message, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'}`}>
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-bg-sub text-ink-faint">
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
