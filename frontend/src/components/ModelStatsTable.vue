<template>
  <div class="rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl">
    <h2 class="mb-4 text-[11px] uppercase tracking-[0.06em] text-apple-muted">By Model</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-apple-line text-left text-[11px] uppercase tracking-[0.05em] text-apple-muted">
            <th
              v-for="column in sortableColumns"
              :key="column.key"
              class="px-3 py-3 font-medium"
              :aria-sort="ariaSort(column.key)"
            >
              <button
                type="button"
                class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-apple-text focus:outline-none focus:ring-2 focus:ring-apple-green/60"
                :aria-sort="ariaSort(column.key)"
                @click="toggleSort(column.key)"
              >
                {{ column.label }} {{ sortIndicator(column.key) }}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="stat in sortedStats"
            :key="stat.model"
            class="border-b border-apple-line text-sm text-apple-row transition-colors hover:bg-apple-surface-strong"
          >
            <td class="px-3 py-3 font-medium text-apple-text">{{ stat.model }}</td>
            <td class="px-3 py-3">${{ stat.cost.toFixed(2) }}</td>
            <td class="px-3 py-3">{{ formatNumber(stat.tokens) }}</td>
            <td class="px-3 py-3">{{ formatNumber(stat.requests) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="sortedStats.length === 0" class="py-8 text-center text-sm text-apple-muted">暂无模型数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatCompactCount } from '../metrics/metricValuePresentation'

interface ModelStats {
  model: string
  cost: number
  tokens: number
  requests: number
}

const props = defineProps<{
  stats: ModelStats[]
}>()

type SortKey = keyof ModelStats
type SortDirection = 'asc' | 'desc'

const sortableColumns: { key: SortKey; label: string }[] = [
  { key: 'model', label: 'Model' },
  { key: 'cost', label: 'Cost' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'requests', label: 'Requests' },
]

const sortKey = ref<SortKey>('cost')
const sortDirection = ref<SortDirection>('desc')

const sortedStats = computed(() => {
  const direction = sortDirection.value === 'asc' ? 1 : -1
  return [...props.stats].sort((a, b) => {
    const primary = compareStats(a, b, sortKey.value)
    if (primary !== 0) return primary * direction
    return a.model.localeCompare(b.model)
  })
})

function compareStats(a: ModelStats, b: ModelStats, key: SortKey): number {
  if (key === 'model') return a.model.localeCompare(b.model)
  return a[key] - b[key]
}

function defaultDirection(key: SortKey): SortDirection {
  return key === 'model' ? 'asc' : 'desc'
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDirection.value = defaultDirection(key)
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}

function formatNumber(num: number): string {
  return formatCompactCount(num)
}
</script>
