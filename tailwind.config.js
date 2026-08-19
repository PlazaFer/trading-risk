/** @type {import('tailwindcss').Config} */

// Colors are declared in index.css as space-separated RGB channels
// (e.g. `--c-primary: 16 185 129`) so Tailwind's `<alpha-value>` slot works.
// That gives us `bg-primary/10`, `border-danger/30`, `text-success/70`, etc.
// for free across every theme.
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: withAlpha('--c-bg'),
          sub: withAlpha('--c-bg-sub'),
          card: withAlpha('--c-bg-card'),
          hover: withAlpha('--c-bg-hover'),
        },
        line: withAlpha('--c-line'),
        ink: {
          DEFAULT: withAlpha('--c-ink'),
          soft: withAlpha('--c-ink-soft'),
          faint: withAlpha('--c-ink-faint'),
        },
        primary: {
          DEFAULT: withAlpha('--c-primary'),
          deep: withAlpha('--c-primary-deep'),
        },
        accent: withAlpha('--c-accent'),
        success: withAlpha('--c-success'),
        danger: withAlpha('--c-danger'),
        warning: withAlpha('--c-warning'),
        info: withAlpha('--c-info'),
      },
      // Tailwind's default scales stop short of a few values this design
      // relies on. Without these the utilities are silently dropped at build
      // time, which shows up as invisible tints rather than as an error.
      opacity: {
        8: '0.08',
        12: '0.12',
        92: '0.92',
      },
      spacing: {
        4.5: '1.125rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        pop: '0 12px 40px -8px rgb(0 0 0 / 0.45)',
        glow: '0 0 0 1px rgb(var(--c-primary) / 0.35), 0 0 24px -4px rgb(var(--c-primary) / 0.35)',
      },
      animation: {
        'fade-in': 'fadeIn .25s ease-out both',
        'slide-up': 'slideUp .28s cubic-bezier(.16,1,.3,1) both',
        'scale-in': 'scaleIn .18s cubic-bezier(.16,1,.3,1) both',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: 0, transform: 'scale(.96)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
