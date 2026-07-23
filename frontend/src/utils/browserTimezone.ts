export function getBrowserTimezone(
  resolve = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  try {
    return resolve() || 'UTC'
  } catch {
    return 'UTC'
  }
}
