<template>
  <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-glass backdrop-blur-xl">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="text-[15px] font-semibold tracking-tight text-apple-text">Token activity</div>
        <div class="mt-1 text-xs text-apple-muted">近 {{ days }} 天 · 点击日期查看半小时贡献（UTC）</div>
      </div>
      <div class="flex items-center gap-1 text-[11px] text-apple-muted">
        <span>Less</span>
        <span v-for="level in [0,1,2,3,4]" :key="level" class="inline-block h-2.5 w-2.5 rounded-[3px]" :class="levelClass(level)" />
        <span>More</span>
      </div>
    </div>

    <div v-if="error" class="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ error }}</div>

    <div v-else class="w-full overflow-visible">
      <div class="grid w-full" :style="gridStyle" role="img" :aria-label="`Token contribution heatmap for ${days} days`">
        <button
          v-for="cell in cells"
          :key="cell.key"
          type="button"
          class="aspect-square w-full min-h-[8px] rounded-[3px] transition-[filter,transform] duration-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-apple-green"
          :class="[
            cell.placeholder ? 'opacity-0 pointer-events-none' : levelClass(cell.level) + ' cursor-pointer',
            selectedDate === cell.date ? 'ring-1 ring-apple-green brightness-125' : '',
            hover?.key === cell.key && !cell.placeholder ? 'brightness-125 scale-110' : ''
          ]"
          :aria-label="cell.title"
          @mouseenter="onEnter(cell, $event)"
          @mousemove="onMove($event)"
          @focus="onEnter(cell, $event)"
          @mouseleave="clearHover(cell)"
          @blur="clearHover(cell)"
          @click="onClick(cell)"
        />
      </div>

      <div class="relative mt-2 h-4 w-full">
        <span
          v-for="m in monthLabels"
          :key="m.key"
          class="absolute top-0 text-[11px] leading-none text-apple-muted"
          :style="{ left: `${(m.week / weekCount) * 100}%` }"
        >{{ m.label }}</span>
      </div>
    </div>

    <!-- Fixed top-layer tooltip so card overflow cannot clip it -->
    <Teleport to="body">
      <div
        v-if="hover && !hover.placeholder"
        class="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#1c1c1e]/95 px-2.5 py-1.5 text-[11px] text-apple-text shadow-xl backdrop-blur-md"
        :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }"
      >
        <span class="font-semibold">{{ formatTokens(hover.tokens) }} tokens</span>
        <span class="text-apple-muted"> on {{ formatDayLabel(hover.date) }}</span>
        <span class="text-apple-muted"> · ${{ hover.cost.toFixed(2) }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DailyHeatPoint } from '../api/client'
import { formatDayLabel, formatTokens, formatUTCDate, monthShort, parseUTCDate } from '../utils/contributionDate'

const GAP = 3
const props = defineProps<{
  points: DailyHeatPoint[]
  days?: number
  error?: string | null
  selectedDate?: string | null
}>()
const emit = defineEmits<{ selectDate: [date: string] }>()

interface GridCell {
  key: string; placeholder: boolean; date: string; tokens: number
  cost: number; requests: number; level: number; title: string
}

const hover = ref<GridCell | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })
const days = computed(() => props.days ?? (props.points.length || 365))

const cells = computed<GridCell[]>(() => {
  const byDate = new Map(props.points.map((p) => [p.date, p]))
  if (props.points.length === 0) return []
  const start = parseUTCDate(props.points[0].date)
  const end = parseUTCDate(props.points[props.points.length - 1].date)
  const lead = start.getUTCDay()
  const out: GridCell[] = []
  for (let i = 0; i < lead; i++) {
    out.push({ key: `pad-${i}`, placeholder: true, date: '', tokens: 0, cost: 0, requests: 0, level: 0, title: '' })
  }
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = formatUTCDate(d)
    const point = byDate.get(key)
    const tokens = point?.tokens ?? 0
    const cost = point?.cost ?? 0
    const requests = point?.requests ?? 0
    const level = point?.level ?? 0
    out.push({
      key, placeholder: false, date: key, tokens, cost, requests, level,
      title: `${formatTokens(tokens)} tokens on ${formatDayLabel(key)}`,
    })
  }
  return out
})

const weekCount = computed(() => Math.max(1, Math.ceil(cells.value.length / 7)))
const gridStyle = computed(() => ({
  gridTemplateRows: 'repeat(7, minmax(10px, 1fr))',
  gridTemplateColumns: `repeat(${weekCount.value}, minmax(0, 1fr))`,
  gridAutoFlow: 'column',
  gap: `${GAP}px`,
  width: '100%',
}))

const monthLabels = computed(() => {
  const labels: { key: string; label: string; week: number }[] = []
  let lastMonth = -1
  for (let w = 0; w < weekCount.value; w++) {
    let month = -1
    for (let r = 0; r < 7; r++) {
      const cell = cells.value[w * 7 + r]
      if (cell && !cell.placeholder) {
        month = parseUTCDate(cell.date).getUTCMonth()
        break
      }
    }
    if (month >= 0 && month !== lastMonth) {
      labels.push({ key: `${w}-${month}`, label: monthShort(month), week: w })
      lastMonth = month
    }
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

function updateTooltipFromEvent(event: Event) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const t = target.getBoundingClientRect()
  tooltipPos.value = { x: t.left + t.width / 2, y: t.top - 6 }
}

function onEnter(cell: GridCell, event: Event) {
  if (cell.placeholder) return
  hover.value = cell
  updateTooltipFromEvent(event)
}
function onMove(event: Event) {
  if (hover.value) updateTooltipFromEvent(event)
}
function clearHover(cell: GridCell) {
  if (hover.value?.key === cell.key) hover.value = null
}
function onClick(cell: GridCell) {
  if (!cell.placeholder && cell.date) emit('selectDate', cell.date)
}
</script>
