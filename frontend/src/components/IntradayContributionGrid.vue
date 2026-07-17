<template>
  <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-glass backdrop-blur-xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-[15px] font-semibold tracking-tight text-apple-text">
          Intraday · {{ formatDayLabel(date) }}
        </div>
        <div class="mt-1 text-xs text-apple-muted">每半小时 · UTC · 48 格（2×24）</div>
      </div>
      <button
        type="button"
        class="rounded-full border border-white/15 px-3 py-1.5 text-xs text-apple-text hover:bg-white/5"
        @click="$emit('close')"
      >返回年历</button>
    </div>

    <div v-if="loading" class="py-8 text-center text-sm text-apple-muted">Loading half-hour grid…</div>
    <div v-else-if="error" class="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ error }}</div>
    <div v-else class="w-full">
      <div class="grid w-full" :style="gridStyle">
        <button
          v-for="cell in points"
          :key="cell.slot"
          type="button"
          class="min-h-[22px] w-full rounded-[4px] transition-[filter] duration-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-apple-green"
          :class="levelClass(cell.level)"
          :aria-label="`${formatTokens(cell.tokens)} tokens at ${cell.slot}`"
          @mouseenter="onEnter(cell, $event)"
          @mousemove="onMove($event)"
          @focus="onEnter(cell, $event)"
          @mouseleave="clearHover(cell)"
          @blur="clearHover(cell)"
        />
      </div>
      <div class="relative mt-2 h-4 w-full">
        <span
          v-for="h in hourLabels"
          :key="h.key"
          class="absolute top-0 text-[11px] leading-none text-apple-muted"
          :style="{ left: `${(h.col / 24) * 100}%` }"
        >{{ h.label }}</span>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hover"
        class="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#1c1c1e]/95 px-2.5 py-1.5 text-[11px] text-apple-text shadow-xl backdrop-blur-md"
        :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }"
      >
        <span class="font-semibold">{{ formatTokens(hover.tokens) }} tokens</span>
        <span class="text-apple-muted"> · {{ hover.slot }}–{{ endSlot(hover.slot) }} UTC</span>
        <span class="text-apple-muted"> · ${{ hover.cost.toFixed(2) }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { IntradayHeatPoint } from '../api/client'
import { formatDayLabel, formatTokens } from '../utils/contributionDate'

const GAP = 4
defineProps<{
  date: string
  points: IntradayHeatPoint[]
  loading?: boolean
  error?: string | null
}>()
defineEmits<{ close: [] }>()

const hover = ref<IntradayHeatPoint | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

// 2 rows × 24 cols = 48 half-hour slots, columns fill full width.
const gridStyle = computed(() => ({
  gridTemplateRows: 'repeat(2, minmax(22px, 1fr))',
  gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
  gridAutoFlow: 'column',
  gap: `${GAP}px`,
  width: '100%',
}))

const hourLabels = computed(() => {
  const labels: { key: string; label: string; col: number }[] = []
  for (let h = 0; h < 24; h += 3) {
    labels.push({ key: `h-${h}`, label: String(h).padStart(2, '0'), col: h })
  }
  return labels
})

function levelClass(level: number): string {
  switch (level) {
    case 1: return 'bg-apple-heat1'
    case 2: return 'bg-apple-heat2'
    case 3: return 'bg-apple-heat3'
    case 4: return 'bg-apple-heat4'
    default: return 'bg-apple-heat0'
  }
}

function endSlot(slot: string): string {
  const [hh, mm] = slot.split(':').map(Number)
  const total = hh * 60 + mm + 30
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function updateTooltipFromEvent(event: Event) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const t = target.getBoundingClientRect()
  tooltipPos.value = { x: t.left + t.width / 2, y: t.top - 6 }
}
function onEnter(cell: IntradayHeatPoint, event: Event) {
  hover.value = cell
  updateTooltipFromEvent(event)
}
function onMove(event: Event) {
  if (hover.value) updateTooltipFromEvent(event)
}
function clearHover(cell: IntradayHeatPoint) {
  if (hover.value?.slot === cell.slot) hover.value = null
}
</script>
