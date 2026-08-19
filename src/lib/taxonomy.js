/**
 * The journal's vocabulary.
 *
 * These are seeds, not a fixed schema — Settings lets you edit every list.
 * The defaults lean toward how index-futures traders actually talk about
 * NQ: session-based frameworks, liquidity concepts, and the specific ways
 * a Nasdaq day goes wrong.
 */

export const DEFAULT_SETUPS = [
  'Opening Range Breakout',
  'Barrido de liquidez',
  'Order Block',
  'FVG / Imbalance',
  'Breaker',
  'Retest de ruptura',
  'Continuación de tendencia',
  'Pullback a EMA',
  'Reversión a VWAP',
  'Fade del rango',
  'Doble techo / piso',
  'Judas Swing',
  'Silver Bullet',
  'Gap fill',
  'Reacción a noticias',
]

export const DEFAULT_MISTAKES = [
  'Entrada tardía / FOMO',
  'Sin confirmación',
  'Moví el stop loss',
  'Salí antes de tiempo',
  'Aguanté la pérdida',
  'Overtrading',
  'Revenge trade',
  'Demasiados contratos',
  'Operé contra la tendencia',
  'Operé en noticias de alto impacto',
  'No respeté el plan',
  'Operé fuera de mi sesión',
  'Promedié a la baja',
  'Sin stop loss',
]

export const DEFAULT_TAGS = [
  'A+',
  'Setup B',
  'Experimental',
  'Alta convicción',
  'Baja liquidez',
  'Día de CPI/FOMC',
  'Tendencia clara',
  'Rango',
  'Alta volatilidad',
]

export const EMOTIONS = [
  { id: 'calm', label: 'Tranquilo', emoji: '😌', tone: 'success' },
  { id: 'focused', label: 'Enfocado', emoji: '🎯', tone: 'primary' },
  { id: 'confident', label: 'Confiado', emoji: '💪', tone: 'primary' },
  { id: 'anxious', label: 'Ansioso', emoji: '😰', tone: 'warning' },
  { id: 'fomo', label: 'FOMO', emoji: '🏃', tone: 'warning' },
  { id: 'greedy', label: 'Codicioso', emoji: '🤑', tone: 'warning' },
  { id: 'fearful', label: 'Con miedo', emoji: '😨', tone: 'danger' },
  { id: 'frustrated', label: 'Frustrado', emoji: '😤', tone: 'danger' },
  { id: 'impatient', label: 'Impaciente', emoji: '⏱️', tone: 'warning' },
  { id: 'tired', label: 'Cansado', emoji: '😴', tone: 'ink-soft' },
  { id: 'bored', label: 'Aburrido', emoji: '🥱', tone: 'ink-soft' },
]

export const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]))

export const MARKET_BIAS = [
  { id: 'bullish', label: 'Alcista', tone: 'success' },
  { id: 'bearish', label: 'Bajista', tone: 'danger' },
  { id: 'neutral', label: 'Neutral / Rango', tone: 'ink-soft' },
]

/** Roles a screenshot plays, so the gallery is self-explaining. */
export const IMAGE_SLOTS = [
  { id: 'before', label: 'Antes / Setup' },
  { id: 'during', label: 'Entrada' },
  { id: 'after', label: 'Resultado' },
]
