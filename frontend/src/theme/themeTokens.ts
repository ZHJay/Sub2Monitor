// Layer: L0 公理层
// Boundary: read live CSS variables for canvas/Chart.js (DOM paint only).

export interface ChartChromeColors {
  tooltipBg: string
  titleColor: string
  bodyColor: string
  borderColor: string
  tickColor: string
  gridColor: string
  axisBorder: string
}

const FALLBACK_DARK: ChartChromeColors = {
  tooltipBg: 'rgba(28,28,30,0.96)',
  titleColor: '#f5f5f7',
  bodyColor: '#d1d1d6',
  borderColor: 'rgba(255,255,255,0.1)',
  tickColor: '#86868B',
  gridColor: 'rgba(255,255,255,0.08)',
  axisBorder: 'rgba(255,255,255,0.12)',
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Chart chrome colors from current document theme tokens. */
export function readChartChromeColors(): ChartChromeColors {
  return {
    tooltipBg: cssVar('--apple-tooltip', FALLBACK_DARK.tooltipBg),
    titleColor: cssVar('--apple-text-solid', FALLBACK_DARK.titleColor),
    bodyColor: cssVar('--apple-row-solid', FALLBACK_DARK.bodyColor),
    borderColor: cssVar('--apple-line-solid', FALLBACK_DARK.borderColor),
    tickColor: cssVar('--apple-muted-solid', FALLBACK_DARK.tickColor),
    gridColor: cssVar('--apple-grid', FALLBACK_DARK.gridColor),
    axisBorder: cssVar('--apple-axis', FALLBACK_DARK.axisBorder),
  }
}
