export const THEMES = [
  { id: 'terminal', name: 'Terminal', swatch: ['#090c11', '#10b981'] },
  { id: 'oceanic', name: 'Oceanic', swatch: ['#080f1a', '#38bdf8'] },
  { id: 'violet', name: 'Violet', swatch: ['#0d0a16', '#a78bfa'] },
  { id: 'carbon', name: 'Carbon', swatch: ['#0a0a0b', '#fafafa'] },
  { id: 'light', name: 'Claro', swatch: ['#f6f7f9', '#059669'] },
]

export function applyTheme(id) {
  const root = document.documentElement
  if (!id || id === 'terminal') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', id)
  root.style.colorScheme = id === 'light' ? 'light' : 'dark'
}
