import { useEffect, useState } from 'react'

const KEYS = {
  bg: '--c-bg',
  bgCard: '--c-bg-card',
  line: '--c-line',
  ink: '--c-ink',
  inkSoft: '--c-ink-soft',
  inkFaint: '--c-ink-faint',
  primary: '--c-primary',
  accent: '--c-accent',
  success: '--c-success',
  danger: '--c-danger',
  warning: '--c-warning',
  info: '--c-info',
}

function read() {
  const styles = getComputedStyle(document.documentElement)
  const out = {}
  for (const [name, varName] of Object.entries(KEYS)) {
    const channels = styles.getPropertyValue(varName).trim()
    out[name] = channels ? `rgb(${channels})` : '#888'
    out[`${name}Raw`] = channels
  }
  out.alpha = (name, a) => `rgb(${out[`${name}Raw`]} / ${a})`
  return out
}

/**
 * Recharts needs real color strings, not CSS variables — SVG gradients and
 * per-datum fills are computed in JS. This reads the active theme's palette
 * and re-reads it whenever the theme attribute flips.
 */
export default function useChartTheme() {
  const [palette, setPalette] = useState(read)

  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(read()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return palette
}
