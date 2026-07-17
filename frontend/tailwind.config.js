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
          bg: '#000000',
          card: 'rgba(28, 28, 30, 0.78)',
          line: 'rgba(255, 255, 255, 0.08)',
          text: '#F5F5F7',
          muted: '#86868B',
          green: '#30D158',
          heat0: '#161618',
          heat1: '#0E4429',
          heat2: '#006D32',
          heat3: '#26A641',
          heat4: '#39D353',
        },
      },
      fontFamily: {
        apple: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 16px 40px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
