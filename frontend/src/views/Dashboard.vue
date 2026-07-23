<template>
  <div class="min-h-screen font-apple text-apple-text">
    <nav class="border-b border-apple-line bg-apple-nav backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold tracking-tight">Sub2Monitor</h1>
          <span class="text-sm text-apple-muted">sub2api</span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-apple-green/30 bg-apple-green/10 px-2.5 py-0.5 text-[11px] text-apple-green">
            <span class="h-1.5 w-1.5 rounded-full bg-apple-green shadow-[0_0_8px_var(--apple-green)]"></span>
            live
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="hidden text-sm text-apple-muted sm:inline">{{ lastUpdateText }}</span>
          <ThemeSwitcher />
          <button
            @click="refreshData"
            :disabled="loading"
            class="rounded-full bg-apple-green px-4 py-2 text-sm font-semibold text-apple-green-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <section class="rounded-2xl border border-apple-line bg-apple-surface p-4 shadow-glass backdrop-blur-xl">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="mr-1 text-[11px] uppercase tracking-[0.06em] text-apple-muted">Cache</span>
            <button
              type="button"
              @click="setIncludeCache(true)"
              :class="pillClass(includeCache)"
            >含 cache</button>
            <button
              type="button"
              @click="setIncludeCache(false)"
              :class="pillClass(!includeCache)"
            >不含 cache</button>
          </div>
          <div class="h-5 w-px bg-apple-line"></div>
          <div class="flex flex-wrap items-center gap-1">
            <span class="mr-1 text-[11px] uppercase tracking-[0.06em] text-apple-muted">Scope</span>
            <button
              type="button"
              @click="setUserScope('all')"
              :class="pillClass(userScope === 'all')"
            >全部用户</button>
            <button
              v-for="email in SCOPE_USER_EMAILS"
              :key="email"
              type="button"
              @click="setUserScope(email)"
              :class="pillClass(userScope === email)"
            >{{ email }}</button>
          </div>
        </div>
      </section>

      <div v-if="error" class="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600">
        <p class="font-medium">Error loading data</p>
        <p class="text-sm opacity-90">{{ error }}</p>
      </div>

      <div v-if="loading && !summary" class="flex h-64 items-center justify-center text-apple-muted">
        Loading dashboard…
      </div>

      <div v-else-if="summary" class="space-y-5">
        <section class="rounded-2xl border border-apple-line bg-apple-surface p-6 shadow-glass backdrop-blur-xl">
          <div class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">Total Cost · 累计成本</div>
          <div class="mt-2 text-5xl font-semibold tracking-tight">
            <RollingNumber :value="`$${summary.totalCost.toFixed(2)}`" />
          </div>
          <div class="mt-2 text-sm text-apple-muted">
            <RollingNumber
              class="align-baseline"
              :value="formatTokens(summary.totalTokens)"
            />
            tokens
            · {{ includeCache ? '含 cache' : '不含 cache' }}
            · {{ scopeLabel }}
            · success
            <RollingNumber
              class="align-baseline"
              :value="successRate"
            />%
          </div>
          <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard title="Hourly Rate" :value="summary.hourlyCost" unit="/hr" />
            <MetricCard title="Total Tokens" :value="summary.totalTokens" />
            <MetricCard title="Requests" :value="summary.requests.total" />
            <MetricCard title="Success Rate" :value="successRate" unit="%" />
            <MetricCard title="Models" :value="modelStats.length" />
            <MetricCard title="Cache Hit Rate" :value="formatCacheHitRate(summary.cacheHitRate)" unit="%" />
          </div>
        </section>

        <TokenContributionGrid
          :points="heatmapPoints"
          :days="heatmapDays"
          :error="heatmapError"
          :selected-date="selectedDate"
          @select-date="selectDate"
        />

        <IntradayContributionGrid
          v-if="selectedDate"
          :date="selectedDate"
          :points="intradayPoints"
          :loading="intradayLoading"
          :error="intradayError"
          @close="closeIntraday"
        />

        <HourlyProfileChart
          :days="hourlyProfileDays"
          :points="hourlyProfilePoints"
          :loading="hourlyProfileLoading"
          :error="hourlyProfileError"
          @update:days="loadHourlyProfile"
        />

        <TimeSeriesChart
          :timestamps="timeSeriesTimestamps"
          :series="timeSeriesSeries"
          v-model:time-range="timeRange"
          v-model:metric="metric"
          @update:time-range="loadTimeSeries"
          @update:metric="loadTimeSeries"
        />

        <ModelStatsTable :stats="modelStats" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import MetricCard from '../components/MetricCard.vue'
import RollingNumber from '../components/RollingNumber.vue'
import TimeSeriesChart from '../components/TimeSeriesChart.vue'
import ModelStatsTable from '../components/ModelStatsTable.vue'
import TokenContributionGrid from '../components/TokenContributionGrid.vue'
import IntradayContributionGrid from '../components/IntradayContributionGrid.vue'
import HourlyProfileChart from '../components/HourlyProfileChart.vue'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'
import { formatTokens, useDashboardMetrics } from '../composables/useDashboardMetrics'
import { formatCacheHitRate } from '../metrics/cacheHitRateDisplay'
import { useTheme } from '../composables/useTheme'

useTheme()

const {
  loading, error, lastUpdateText, summary,
  timeSeriesTimestamps, timeSeriesSeries, modelStats,
  heatmapPoints, heatmapDays, heatmapError, timeRange, metric, successRate,
  includeCache, userScope, scopeLabel, SCOPE_USER_EMAILS,
  selectedDate, intradayPoints, intradayLoading, intradayError,
  hourlyProfileDays, hourlyProfilePoints, hourlyProfileLoading, hourlyProfileError,
  refreshData, loadTimeSeries, loadHourlyProfile, setIncludeCache, setUserScope,
  selectDate, closeIntraday
} = useDashboardMetrics()

function pillClass(active: boolean): string {
  return active
    ? 'rounded-full bg-apple-green px-3 py-1.5 text-xs font-semibold text-apple-green-ink'
    : 'rounded-full border border-apple-line bg-apple-surface-strong px-3 py-1.5 text-xs text-apple-muted hover:text-apple-text'
}
</script>
