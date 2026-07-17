import axios, { AxiosInstance } from 'axios'

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api', timeout: 30_000, withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      window.dispatchEvent(new Event('apimonitor:auth-lost'))
    }
    return Promise.reject(error)
  }
)

export const PERSONAL_USER_EMAIL = 'zhanghjay.ng@gmail.com'
export type UserScope = 'all' | 'personal'
export interface MetricsQuery { includeCache?: boolean; userScope?: UserScope }

export interface MetricsSummaryResponse {
  totalCost: number
  hourlyCost: number
  totalTokens: number
  requests: { total: number; success: number; failed: number }
  includeCache?: boolean
  userEmail?: string
  timestamp: string
}
export interface TimeSeriesPoint { timestamp: string; value: number; model?: string }
export interface TimeSeriesModelSeries { model: string; values: number[] }
export interface TimeSeriesResponse {
  timestamps: string[]
  series: TimeSeriesModelSeries[]
  data?: TimeSeriesPoint[]
  range: string
  interval: string
  metric: string
  includeCache?: boolean
  userEmail?: string
}
export interface ModelStats { model: string; cost: number; tokens: number; requests: number }
export interface ModelStatsResponse {
  data: ModelStats[]; includeCache?: boolean; userEmail?: string; timestamp: string
}
export interface DailyHeatPoint {
  date: string; tokens: number; cost: number; requests: number; level: number
}
export interface DailyHeatmapResponse {
  metric: string; days: number; timezone: string; startDate: string; endDate: string
  points: DailyHeatPoint[]; levels: { thresholds: number[]; maxTokens: number }
  includeCache?: boolean; userEmail?: string; timestamp: string
}
export interface IntradayHeatPoint {
  slot: string; tokens: number; cost: number; requests: number; level: number
}
export interface IntradayHeatmapResponse {
  date: string; timezone: string; intervalMin: number
  points: IntradayHeatPoint[]; levels: { thresholds: number[]; maxTokens: number }
  includeCache?: boolean; userEmail?: string; timestamp: string
}

function metricsParams(query: MetricsQuery = {}) {
  return {
    include_cache: query.includeCache === false ? 'false' : 'true',
    user_scope: query.userScope === 'personal' ? 'personal' : 'all',
  }
}

export async function createSSOChallenge(): Promise<string> {
  return (await apiClient.post<{ state: string }>('/auth/sso/challenge')).data.state
}
export async function getSSOSession(): Promise<void> { await apiClient.get('/auth/sso/session') }
export async function exchangeSSOToken(state: string, token: string): Promise<void> {
  await apiClient.post('/auth/sso/exchange', { state, token })
}
export async function logout(): Promise<void> { await apiClient.post('/auth/sso/logout') }
export async function getSummary(query: MetricsQuery = {}): Promise<MetricsSummaryResponse> {
  return (await apiClient.get('/metrics/summary', { params: metricsParams(query) })).data
}
export async function getTimeSeries(range: string, interval: string, metric: string, query: MetricsQuery = {}): Promise<TimeSeriesResponse> {
  return (await apiClient.get('/metrics/timeseries', { params: { range, interval, metric, ...metricsParams(query) } })).data
}
export async function getByModel(query: MetricsQuery = {}): Promise<ModelStatsResponse> {
  return (await apiClient.get('/metrics/by-model', { params: metricsParams(query) })).data
}
export async function getDailyHeatmap(days = 365, metric = 'tokens', query: MetricsQuery = {}): Promise<DailyHeatmapResponse> {
  return (await apiClient.get('/metrics/daily-heatmap', { params: { days, metric, ...metricsParams(query) } })).data
}
export async function getIntradayHeatmap(date: string, query: MetricsQuery = {}): Promise<IntradayHeatmapResponse> {
  return (await apiClient.get('/metrics/intraday-heatmap', { params: { date, ...metricsParams(query) } })).data
}
