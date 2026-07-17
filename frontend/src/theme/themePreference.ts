// Layer: L0 公理层
// Contract: preference is user intent; resolved theme is the effective paint mode.

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_PREFERENCE_STORAGE_KEY = 'sub2monitor-theme-preference'
export const THEME_PREFERENCE_OPTIONS: readonly ThemePreference[] = ['system', 'light', 'dark'] as const
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Resolve stored preference + OS scheme into an effective light/dark theme. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return systemPrefersDark ? 'dark' : 'light'
}

export function readStoredThemePreference(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : null,
): ThemePreference {
  try {
    const raw = storage?.getItem(THEME_PREFERENCE_STORAGE_KEY)
    return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export function writeStoredThemePreference(
  preference: ThemePreference,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : null,
): void {
  try {
    storage?.setItem(THEME_PREFERENCE_STORAGE_KEY, preference)
  } catch {
    // private mode / blocked storage — keep in-memory only
  }
}
