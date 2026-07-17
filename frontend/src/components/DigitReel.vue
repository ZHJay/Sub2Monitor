<template>
  <span
    class="digit-reel"
    aria-hidden="true"
    :class="{ 'digit-reel--tick': ticking }"
  >
    <span ref="stripEl" class="digit-reel__strip">
      <span
        v-for="(d, i) in strip"
        :key="`${playId}-${mode}-${i}-${d}`"
        class="digit-reel__cell"
      >{{ d }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
// Layer: L1 积木层
// Contract: full=首次完整揭晓；partial=旧→新短距；idle=静止。
// Boundary: 轨迹来自 digitReelMath；不因父级无关重渲染整圈重播。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  REEL_EASING,
  buildPartialStrip,
  buildReelStrip,
  partialKeyframes,
  planPartialSpin,
  planReelSpin,
  reelKeyframes,
  type ReelMotionMode,
} from '../utils/digitReelMath'

const props = defineProps<{
  digit: number
  fromDigit: number
  fromRight: number
  mode: ReelMotionMode
  steps: number
  playId: number
  reducedMotion: boolean
}>()

const stripEl = ref<HTMLElement | null>(null)
const ticking = ref(false)
let animation: Animation | null = null
let playGen = 0
let tickTimer: number | null = null

const fullPlan = computed(() =>
  planReelSpin(props.digit, props.fromRight, props.reducedMotion || props.mode !== 'full')
)

const strip = computed(() => {
  if (props.mode === 'partial' && props.steps !== 0 && !props.reducedMotion) {
    return buildPartialStrip(props.fromDigit, props.steps)
  }
  if (props.mode === 'full' && !props.reducedMotion) {
    return buildReelStrip(props.digit, fullPlan.value.cycles)
  }
  return [props.digit]
})

function cancelAnim() {
  if (animation) {
    animation.onfinish = null
    animation.cancel()
    animation = null
  }
  if (tickTimer != null) {
    window.clearTimeout(tickTimer)
    tickTimer = null
  }
  ticking.value = false
}

/** 结束后吸附到整数 px，减轻子像素模糊。 */
function settle(el: HTMLElement, finalIndex: number) {
  const cell = el.querySelector('.digit-reel__cell') as HTMLElement | null
  const h = cell?.getBoundingClientRect().height ?? 0
  if (h > 0) {
    el.style.transform = `translateY(${-Math.round(finalIndex * h)}px)`
  } else {
    el.style.transform = `translateY(${-finalIndex}em)`
  }
}

function pulseTick(delayMs: number) {
  tickTimer = window.setTimeout(() => {
    ticking.value = true
    tickTimer = window.setTimeout(() => { ticking.value = false; tickTimer = null }, 100)
  }, delayMs)
}

async function play() {
  const gen = ++playGen
  await nextTick()
  if (gen !== playGen) return
  const el = stripEl.value
  if (!el) return
  cancelAnim()

  if (props.reducedMotion || props.mode === 'idle') {
    settle(el, 0)
    return
  }

  if (props.mode === 'partial') {
    const plan = planPartialSpin(props.steps)
    if (plan.durationMs <= 0 || plan.finalIndex === 0) {
      settle(el, 0)
      return
    }
    el.getAnimations?.().forEach((a) => a.cancel())
    el.style.transform = 'translateY(0px)'
    animation = el.animate(partialKeyframes(props.steps), {
      duration: plan.durationMs,
      delay: 0,
      easing: REEL_EASING,
      fill: 'forwards',
    })
    pulseTick(plan.durationMs * 0.88)
    animation.onfinish = () => { if (gen === playGen) settle(el, plan.finalIndex) }
    return
  }

  // full
  const plan = planReelSpin(props.digit, props.fromRight, false)
  el.getAnimations?.().forEach((a) => a.cancel())
  el.style.transform = 'translateY(0px)'
  animation = el.animate(reelKeyframes(plan.finalIndex, props.fromRight), {
    duration: plan.durationMs,
    delay: plan.delayMs,
    easing: REEL_EASING,
    fill: 'forwards',
  })
  pulseTick(plan.delayMs + plan.durationMs * 0.9)
  animation.onfinish = () => { if (gen === playGen) settle(el, plan.finalIndex) }
}

onMounted(play)
watch(
  () => [props.playId, props.mode, props.digit, props.fromDigit, props.steps, props.reducedMotion],
  play
)
onBeforeUnmount(() => { playGen += 1; cancelAnim() })
</script>

<style scoped>
.digit-reel__strip {
  display: block;
  will-change: transform;
  transform: translateY(0);
  backface-visibility: hidden;
}
.digit-reel__cell {
  display: block;
  height: 1em;
  width: 1ch;
  line-height: 1;
  text-align: center;
}
</style>
