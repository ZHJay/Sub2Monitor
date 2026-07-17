<template>
  <span class="rolling-number" :aria-label="display">
    <template v-for="(token, i) in tokens" :key="`${playId}-${i}-${tokenKey(token)}`">
      <DigitReel
        v-if="token.kind === 'digit'"
        :digit="token.digit"
        :from-right="token.fromRight"
        :reduced-motion="reducedMotion"
        :play-id="playId"
      />
      <span
        v-else
        class="rolling-number__static"
        aria-hidden="true"
      >{{ token.char }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
// Layer: L1 积木层
// Contract: 接收最终展示串；数值变化时重播机械滚轮，真实数据不被随机改写。
// Boundary: 非数字字符静止；prefers-reduced-motion 直接定格。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DigitReel from './DigitReel.vue'
import { tokenizeDisplay, type ReelToken } from '../utils/digitReelMath'

const props = withDefaults(defineProps<{
  /** 已格式化的最终展示文本，如 `$12.34`、`1.2M`、`98.5%`、`12/34`。 */
  value: string | number
  /** 每次数据刷新递增；值未变也会强制重播滚轮。 */
  playKey?: number
}>(), {
  playKey: 0,
})

const display = computed(() => String(props.value ?? ''))
const tokens = computed(() => tokenizeDisplay(display.value))
const playId = ref(0)
const reducedMotion = ref(false)

let media: MediaQueryList | null = null

function onMotionChange() {
  reducedMotion.value = Boolean(media?.matches)
}

function tokenKey(token: ReelToken): string {
  return token.kind === 'digit'
    ? `d${token.digit}-${token.fromRight}`
    : `s${token.char}`
}

function bumpPlay() {
  playId.value += 1
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  media.addEventListener?.('change', onMotionChange)
  // 兼容旧 WebKit
  media.addListener?.(onMotionChange)
})

onBeforeUnmount(() => {
  media?.removeEventListener?.('change', onMotionChange)
  media?.removeListener?.(onMotionChange)
})

// 展示串变化或外部 refresh key 变化 → 重播。
watch([display, () => props.playKey], bumpPlay)

/** 供父级在「值未变但已重新拉取」时强制揭晓动画。 */
function replay() {
  bumpPlay()
}

defineExpose({ replay })
</script>

<style scoped>
.rolling-number {
  display: inline-flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  letter-spacing: 0.02em;
  line-height: 1;
}

.rolling-number__static {
  display: inline-block;
  line-height: 1;
  white-space: pre;
}
</style>
