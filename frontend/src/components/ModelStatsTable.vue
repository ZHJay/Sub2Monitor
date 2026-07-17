<template>
  <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-glass backdrop-blur-xl">
    <h2 class="mb-4 text-[11px] uppercase tracking-[0.06em] text-apple-muted">By Model</h2>
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.05em] text-apple-muted">
            <th class="px-3 py-3 font-medium">Model</th>
            <th class="px-3 py-3 font-medium">Cost</th>
            <th class="px-3 py-3 font-medium">Tokens</th>
            <th class="px-3 py-3 font-medium">Requests</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="stat in sortedStats"
            :key="stat.model"
            class="border-b border-white/5 text-sm text-[#d1d1d6] transition-colors hover:bg-white/[0.03]"
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
import { computed } from 'vue'

interface ModelStats {
  model: string
  cost: number
  tokens: number
  requests: number
}

const props = defineProps<{
  stats: ModelStats[]
}>()

const sortedStats = computed(() => {
  return [...props.stats].sort((a, b) => b.cost - a.cost)
})

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}
</script>
