<template>
  <span
    class="digit-reel"
    aria-hidden="true"
    :class="{ 'digit-reel--tick': ticking }"
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
// Boundary: 单数字机械滚筒；轨迹由 digitReelMath 采样，WAAPI linear 播放。
// Why: 位移曲线含过冲/阻尼回摆，不能用单段 CSS ease-out。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  playId: number
}>()

const stripEl = ref<HTMLElement | null>(null)
const ticking = ref(false)
let animation: Animation | null = null
let playGen = 0
let tickTimer: number | null = null

const plan = computed(() =>
  planReelSpin(props.digit, props.fromRight, props.reducedMotion)
)

const strip = computed(() => buildReelStrip(props.digit, plan.value.cycles))

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

function settle(el: HTMLElement, finalIndex: number) {
  el.style.transform = `translateY(${-finalIndex}em)`
}

function pulseTick(delayMs: number) {
  // 锁定瞬间极轻机械震动；不影响最终位移。
  tickTimer = window.setTimeout(() => {
    ticking.value = true
    tickTimer = window.setTimeout(() => { ticking.value = false; tickTimer = null }, 120)
  }, delayMs)
}

async function play() {
  const gen = ++playGen
  await nextTick()
  if (gen !== playGen) return

  const el = stripEl.value
  if (!el) return
  cancelAnim()

  const { finalIndex, durationMs, delayMs } = plan.value
  if (props.reducedMotion || durationMs <= 0) {
    settle(el, finalIndex)
    return
  }

  el.getAnimations?.().forEach((a) => a.cancel())
  el.style.transform = 'translateY(0em)'

  // linear：时间均匀；机械感全在采样关键帧里。
  animation = el.animate(reelKeyframes(finalIndex, props.fromRight), {
    duration: durationMs,
    delay: delayMs,
    easing: REEL_EASING,
    fill: 'forwards',
  })

  // 主旋转约 72% 后进入回摆；在接近终点时轻震一次。
  pulseTick(delayMs + durationMs * 0.9)

  animation.onfinish = () => {
    if (gen !== playGen) return
    settle(el, finalIndex)
  }
}

onMounted(play)
watch(() => [props.digit, props.fromRight, props.playId, props.reducedMotion], play)
onBeforeUnmount(() => {
  playGen += 1
  cancelAnim()
})
</script>

<style scoped>
/* 机械滚筒视窗：固定高度 + 遮罩，滚动时可见上下邻位 */
.digit-reel {
  position: relative;
  display: inline-block;
  height: 1em;
  width: 1ch;
  overflow: hidden;
  vertical-align: -0.12em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  border-radius: 0.12em;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--apple-text-solid) 10%, transparent) 0%,
      transparent 28%,
      transparent 72%,
      color-mix(in srgb, var(--apple-text-solid) 10%, transparent) 100%
    ),
    color-mix(in srgb, var(--apple-elevated) 55%, transparent);
  box-shadow:
    inset 0 0.08em 0.14em rgba(0, 0, 0, 0.35),
    inset 0 -0.06em 0.1em rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px color-mix(in srgb, var(--apple-text-solid) 8%, transparent);
  transform: translateZ(0);
}

.digit-reel::before,
.digit-reel::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  z-index: 1;
  pointer-events: none;
  height: 34%;
}

.digit-reel::before {
  top: 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--apple-bg) 72%, transparent),
    transparent
  );
}

.digit-reel::after {
  bottom: 0;
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--apple-bg) 72%, transparent),
    transparent
  );
}

.digit-reel--tick {
  animation: reel-tick 120ms ease-out;
}

@keyframes reel-tick {
  0% { transform: translateY(0); }
  40% { transform: translateY(0.02em); }
  100% { transform: translateY(0); }
}

.digit-reel__strip {
  display: block;
  will-change: transform;
  transform: translateY(0em);
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
