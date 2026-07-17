import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  type ResolvedTheme,
  type ThemePreference,
  readStoredThemePreference,
  resolveTheme,
  writeStoredThemePreference,
} from '../theme/themePreference'

// Layer: L1 积木层
// Contract: single source for preference + resolved theme; applies to <html>.

const preference = ref<ThemePreference>(readStoredThemePreference())
const systemPrefersDark = ref(false)
let media: MediaQueryList | null = null
let mediaHandler: ((event: MediaQueryListEvent) => void) | null = null
let listeners = 0

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

function ensureMediaListener() {
  if (typeof window === 'undefined' || !window.matchMedia || media) return
  media = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = media.matches
  mediaHandler = (event) => {
    systemPrefersDark.value = event.matches
  }
  media.addEventListener('change', mediaHandler)
}

function releaseMediaListener() {
  if (!media || !mediaHandler) return
  media.removeEventListener('change', mediaHandler)
  media = null
  mediaHandler = null
}

const resolvedTheme = computed<ResolvedTheme>(() =>
  resolveTheme(preference.value, systemPrefersDark.value),
)

watch(resolvedTheme, (theme) => applyResolvedTheme(theme), { immediate: true })

export function useTheme() {
  onMounted(() => {
    listeners += 1
    ensureMediaListener()
    systemPrefersDark.value = readSystemPrefersDark()
    applyResolvedTheme(resolvedTheme.value)
  })

  onBeforeUnmount(() => {
    listeners = Math.max(0, listeners - 1)
    if (listeners === 0) releaseMediaListener()
  })

  function setPreference(next: ThemePreference) {
    preference.value = next
    writeStoredThemePreference(next)
    applyResolvedTheme(resolveTheme(next, systemPrefersDark.value))
  }

  return {
    preference,
    resolvedTheme,
    setPreference,
  }
}

/** Call once at app boot before mount to avoid a wrong-theme flash. */
export function bootstrapTheme() {
  systemPrefersDark.value = readSystemPrefersDark()
  preference.value = readStoredThemePreference()
  ensureMediaListener()
  applyResolvedTheme(resolveTheme(preference.value, systemPrefersDark.value))
}
