<template>
  <span
    class="digit-reel"
    aria-hidden="true"
    :style="{ '--reel-duration': `${plan.durationMs}ms`, '--reel-delay': `${plan.delayMs}ms` }"
  >
    <span ref="stripEl" class="digit-reel__strip">
      <span
        v-for="(d, i) in strip"
        :key="`${playId}-${i}-${d}`"
        class="digit-reel__cell"
      >{{ d }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
// Layer: L1 积木层
// Boundary: 单数字垂直滚轮；时序由 digitReelMath 决定，不碰业务数据。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  REEL_EASING,
  buildReelStrip,
  planReelSpin,
  reelKeyframes,
} from '../utils/digitReelMath'

const props = defineProps<{
  digit: number
  fromRight: number
  reducedMotion: boolean
  /** 递增即可强制重播（数值更新 / 手动 refresh）。 */
  playId: number
}>()

const stripEl = ref<HTMLElement | null>(null)
let animation: Animation | null = null

const plan = computed(() =>
  planReelSpin(props.digit, props.fromRight, props.reducedMotion)
)

const strip = computed(() => buildReelStrip(props.digit, plan.value.cycles))

function cancelAnim() {
  animation?.cancel()
  animation = null
}

function play() {
  const el = stripEl.value
  if (!el) return
  cancelAnim()

  const { finalIndex, durationMs, delayMs } = plan.value
  if (props.reducedMotion || durationMs <= 0) {
    el.style.transform = `translateY(${-finalIndex}em)`
    return
  }

  el.style.transform = 'translateY(0em)'
  animation = el.animate(reelKeyframes(finalIndex), {
    duration: durationMs,
    delay: delayMs,
    easing: REEL_EASING,
    fill: 'forwards',
  })
}

onMounted(play)
watch(() => [props.digit, props.fromRight, props.playId, props.reducedMotion], play)
onBeforeUnmount(cancelAnim)
</script>

<style scoped>
.digit-reel {
  display: inline-block;
  height: 1em;
  width: 1ch;
  overflow: hidden;
  vertical-align: -0.12em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.digit-reel__strip {
  display: block;
  will-change: transform;
  transform: translateY(0em);
}

.digit-reel__cell {
  display: block;
  height: 1em;
  width: 1ch;
  line-height: 1;
  text-align: center;
}
</style>
