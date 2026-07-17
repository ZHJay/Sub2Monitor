import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  readStoredThemePreference,
  resolveTheme,
  THEME_PREFERENCE_STORAGE_KEY,
  writeStoredThemePreference,
} from './themePreference'

describe('themePreference', () => {
  it('defaults to system and resolves via OS scheme', () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe('system')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('validates and persists preference', () => {
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('auto')).toBe(false)

    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
    }

    expect(readStoredThemePreference(storage)).toBe('system')
    writeStoredThemePreference('light', storage)
    expect(store.get(THEME_PREFERENCE_STORAGE_KEY)).toBe('light')
    expect(readStoredThemePreference(storage)).toBe('light')
  })
})
