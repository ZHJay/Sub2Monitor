export function formatCacheHitRate(percent: number): string {
  if (!Number.isFinite(percent)) return '0.0'
  return Math.min(100, Math.max(0, percent)).toFixed(1)
}
