/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: 'var(--apple-bg)',
          card: 'var(--apple-card)',
          surface: 'var(--apple-surface)',
          'surface-strong': 'var(--apple-surface-strong)',
          elevated: 'var(--apple-elevated)',
          nav: 'var(--apple-nav)',
          overlay: 'var(--apple-overlay)',
          tooltip: 'var(--apple-tooltip)',
          // line uses fixed theme alpha; green/text keep <alpha-value> for /10 /30
          line: 'rgb(var(--apple-line) / var(--apple-line-alpha))',
          'line-strong': 'rgb(var(--apple-line) / var(--apple-line-strong-alpha))',
          text: 'rgb(var(--apple-text) / <alpha-value>)',
          muted: 'rgb(var(--apple-muted) / <alpha-value>)',
          row: 'rgb(var(--apple-row) / <alpha-value>)',
          green: 'rgb(var(--apple-green) / <alpha-value>)',
          'green-ink': 'rgb(var(--apple-green-ink) / <alpha-value>)',
          heat0: 'var(--apple-heat0)',
          heat1: 'var(--apple-heat1)',
          heat2: 'var(--apple-heat2)',
          heat3: 'var(--apple-heat3)',
          heat4: 'var(--apple-heat4)',
        },
      },
      fontFamily: {
        apple: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: 'var(--apple-shadow)',
      },
    },
  },
  plugins: [],
}
