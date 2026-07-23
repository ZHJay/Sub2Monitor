// Pure date/token display helpers for the contribution grid.
import { formatCompactCount } from '../metrics/metricValuePresentation'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseUTCDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function formatUTCDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDayLabel(value: string): string {
  const date = parseUTCDate(value)
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

export function formatTokens(num: number): string {
  return formatCompactCount(num)
}

export function monthShort(monthIndex: number): string {
  return MONTHS[monthIndex] ?? ''
}
