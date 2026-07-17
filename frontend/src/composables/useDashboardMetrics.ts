import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  getSummary,
  getTimeSeries,
  getByModel,
  getDailyHeatmap,
  getIntradayHeatmap,
  PERSONAL_USER_EMAIL,
  type MetricsSummaryResponse,
  type TimeSeriesModelSeries,
  type ModelStats,
  type DailyHeatPoint,
  type IntradayHeatPoint,
  type UserScope
} from '../api/client'

// Layer: L2 流程层（前端）
// Boundary: 编排 metrics 拉取、筛选与日下钻；UI 只消费状态。
export function useDashboardMetrics() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdate = ref<Date | null>(null)
  /** 摘要成功刷新计数：驱动机械滚轮在每次 load/refresh 重播。 */
  const metricsRevealKey = ref(0)
  const summary = ref<MetricsSummaryResponse | null>(null)
  const timeSeriesTimestamps = ref<string[]>([])
  const timeSeriesSeries = ref<TimeSeriesModelSeries[]>([])
  const modelStats = ref<ModelStats[]>([])
  const heatmapPoints = ref<DailyHeatPoint[]>([])
  const heatmapDays = ref(365)
  const heatmapError = ref<string | null>(null)
  const timeRange = ref('24h')
  const metric = ref('cost')
  const includeCache = ref(true)
  const userScope = ref<UserScope>('all')

  const selectedDate = ref<string | null>(null)
  const intradayPoints = ref<IntradayHeatPoint[]>([])
  const intradayLoading = ref(false)
  const intradayError = ref<string | null>(null)

  let refreshInterval: number | null = null
  let timeSeriesRequestSequence = 0
  let intradayRequestSequence = 0

  const query = computed(() => ({
    includeCache: includeCache.value,
    userScope: userScope.value
  }))

  const successRate = computed(() => {
    if (!summary.value) return '0.0'
    const { total, success } = summary.value.requests
    if (total === 0) return '0.0'
    return ((success / total) * 100).toFixed(1)
  })

  const lastUpdateText = computed(() => {
    if (!lastUpdate.value) return ''
    const diff = Math.floor((Date.now() - lastUpdate.value.getTime()) / 1000)
    if (diff < 10) return 'updated just now'
    if (diff < 60) return `updated ${diff}s ago`
    if (diff < 3600) return `updated ${Math.floor(diff / 60)}m ago`
    return `updated ${Math.floor(diff / 3600)}h ago`
  })

  const scopeLabel = computed(() =>
    userScope.value === 'personal' ? PERSONAL_USER_EMAIL : '全部用户'
  )

  async function loadTimeSeries() {
    const requestSequence = ++timeSeriesRequestSequence
    const requestedRange = timeRange.value
    const requestedMetric = metric.value
    // Short windows use 15m buckets so the axis has enough points to span full width smoothly.
    const interval = (requestedRange === '1h' || requestedRange === '6h') ? '15min' : '1h'
    try {
      const response = await getTimeSeries(requestedRange, interval, requestedMetric, query.value)
      if (requestSequence === timeSeriesRequestSequence) {
        timeSeriesTimestamps.value = response.timestamps || []
        timeSeriesSeries.value = response.series || []
      }
    } catch (err: any) {
      if (requestSequence === timeSeriesRequestSequence) {
        throw new Error(`Failed to load time series: ${err.message}`)
      }
    }
  }

  async function loadHeatmap() {
    try {
      const response = await getDailyHeatmap(365, 'tokens', query.value)
      heatmapPoints.value = response.points
      heatmapDays.value = response.days
      heatmapError.value = null
    } catch (err: any) {
      heatmapError.value = err.message || 'Failed to load heatmap'
    }
  }

  async function loadIntraday(date: string) {
    const requestSequence = ++intradayRequestSequence
    intradayLoading.value = true
    intradayError.value = null
    try {
      const response = await getIntradayHeatmap(date, query.value)
      if (requestSequence === intradayRequestSequence) {
        intradayPoints.value = response.points
      }
    } catch (err: any) {
      if (requestSequence === intradayRequestSequence) {
        intradayError.value = err.message || 'Failed to load intraday heatmap'
        intradayPoints.value = []
      }
    } finally {
      if (requestSequence === intradayRequestSequence) {
        intradayLoading.value = false
      }
    }
  }

  async function selectDate(date: string) {
    selectedDate.value = date
    await loadIntraday(date)
  }

  function closeIntraday() {
    selectedDate.value = null
    intradayPoints.value = []
    intradayError.value = null
  }

  async function refreshData() {
    loading.value = true
    error.value = null
    try {
      const tasks: Promise<unknown>[] = [
        getSummary(query.value).then((data) => {
          summary.value = data
          // 与数据同帧递增，避免先挂载再二次触发导致双重动画。
          metricsRevealKey.value += 1
        }),
        loadTimeSeries(),
        getByModel(query.value).then((response) => { modelStats.value = response.data }),
        loadHeatmap()
      ]
      if (selectedDate.value) tasks.push(loadIntraday(selectedDate.value))
      const results = await Promise.allSettled(tasks)
      const hardFailures = results
        .slice(0, 3)
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (hardFailures.length > 0) {
        error.value = hardFailures.map((r) => String(r.reason?.message || r.reason)).join('; ')
      } else {
        lastUpdate.value = new Date()
      }
    } finally {
      loading.value = false
    }
  }

  function setIncludeCache(value: boolean) { includeCache.value = value }
  function setUserScope(value: UserScope) { userScope.value = value }

  watch([includeCache, userScope], () => { refreshData() })

  function startAutoRefresh() {
    refreshData()
    refreshInterval = window.setInterval(() => { refreshData() }, 30000)
  }
  function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval)
  }

  onMounted(startAutoRefresh)
  onUnmounted(stopAutoRefresh)

  return {
    loading, error, lastUpdateText, summary, metricsRevealKey,
    timeSeriesTimestamps, timeSeriesSeries, modelStats,
    heatmapPoints, heatmapDays, heatmapError, timeRange, metric, successRate,
    includeCache, userScope, scopeLabel, PERSONAL_USER_EMAIL,
    selectedDate, intradayPoints, intradayLoading, intradayError,
    refreshData, loadTimeSeries, setIncludeCache, setUserScope,
    selectDate, closeIntraday
  }
}

export function formatTokens(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}
