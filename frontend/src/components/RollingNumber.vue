<template>
  <span class="rolling-number" :aria-label="display">
    <template v-for="slot in slots" :key="slot.key">
      <DigitReel
        v-if="slot.kind === 'digit'"
        class="rolling-number__digit"
        :digit="slot.digit"
        :from-digit="slot.fromDigit"
        :from-right="slot.fromRight"
        :mode="slot.mode"
        :steps="slot.steps"
        :play-id="slot.playId"
        :reduced-motion="reducedMotion"
      />
      <span
        v-else
        class="rolling-number__static"
        aria-hidden="true"
      >{{ slot.char }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
// Layer: L1 积木层
// Contract: 首次完整机械揭晓；之后只对变化数字位做短距 partial。
// Invariant: 生命周期内首次 full 只一次，除非 force replay / 卸载重挂。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DigitReel from './DigitReel.vue'
import { diffReelSlots, type ReelSlot } from '../utils/digitReelDiff'

const props = withDefaults(defineProps<{
  value: string | number
  /** 递增时强制完整重播（可选）；普通刷新勿传。 */
  playKey?: number
}>(), {
  playKey: 0,
})

const display = computed(() => String(props.value ?? ''))
const reducedMotion = ref(false)
const hasRevealed = ref(false)
const previous = ref('')
const playIds = ref<Map<string, number>>(new Map())
const slots = ref<ReelSlot[]>([])
const lastPlayKey = ref(props.playKey)

let media: MediaQueryList | null = null

function onMotionChange() {
  reducedMotion.value = Boolean(media?.matches)
}

function apply(next: string, forceFull: boolean) {
  const result = diffReelSlots({
    previous: previous.value,
    next,
    hasRevealed: hasRevealed.value,
    forceFull,
    reducedMotion: reducedMotion.value,
    playIds: playIds.value,
  })
  slots.value = result.slots
  playIds.value = result.playIds
  hasRevealed.value = result.hasRevealed
  previous.value = next
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  media.addEventListener?.('change', onMotionChange)
  media.addListener?.(onMotionChange)
  apply(display.value, true)
})

onBeforeUnmount(() => {
  media?.removeEventListener?.('change', onMotionChange)
  media?.removeListener?.(onMotionChange)
})

watch(display, (next) => {
  if (next === previous.value) return
  apply(next, false)
})

watch(() => props.playKey, (key) => {
  if (key === lastPlayKey.value) return
  lastPlayKey.value = key
  // 外部显式 replay：完整动画一次
  hasRevealed.value = false
  apply(display.value, true)
})

watch(reducedMotion, () => {
  apply(display.value, false)
})

function replay() {
  hasRevealed.value = false
  apply(display.value, true)
}

defineExpose({ replay })
</script>

<style scoped>
.rolling-number {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  align-items: baseline;
  gap: 0.04em;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  letter-spacing: 0.04em;
  line-height: 1;
}
.rolling-number__static {
  display: inline-block;
  flex: 0 0 auto;
  line-height: 1;
  white-space: pre;
  padding: 0 0.02em;
}
.rolling-number__digit {
  flex: 0 0 auto;
}
</style>
