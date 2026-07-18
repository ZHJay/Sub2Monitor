# Cache Hit Rate 指标实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 summary API 和 Dashboard 中增加按 prompt token 计算的 Cache Hit Rate，并保持 Scope、刷新性能与 release artifact 一致性。

**架构：** L0 定义 token summary 与百分比纯规则；L1 在现有 token 聚合查询中一次返回 total/read/eligible；L2 组装 summary；Vue 通过新增 API 字段显示第 6 张卡片。开发按用户选择直接在 `main` 上进行。

**技术栈：** Go 1.25、GORM/Postgres、go-sqlmock、Vue 3、TypeScript、Vitest、Vite。

---

## 文件结构

- 创建 `backend/internal/l0_axioms/cache_hit_rate.go`：cache token 值类型与百分比规则。
- 创建 `backend/internal/l0_axioms/cache_hit_rate_test.go`：L0 边界测试。
- 修改 `backend/internal/l0_axioms/models.go`：summary JSON 新字段。
- 创建 `backend/internal/l1_blocks/usage_query_token_summary_test.go`：SQL 聚合与 Scope 测试。
- 修改 `backend/internal/l1_blocks/usage_query.go`：单次 token summary 查询。
- 创建 `backend/internal/l2_flows/metrics_aggregator_summary_test.go`：summary flow/API JSON 契约。
- 修改 `backend/internal/l2_flows/metrics_aggregator.go`：组装命中率。
- 创建 `frontend/src/metrics/cacheHitRateDisplay.ts`：百分比显示边界。
- 创建 `frontend/src/metrics/cacheHitRateDisplay.test.ts`：显示规则测试。
- 修改 `frontend/src/api/client.ts`：summary 类型字段。
- 修改 `frontend/src/views/Dashboard.vue`：第 6 张卡片和响应式网格。
- 更新 `frontend/dist/`、`backend/sub2monitor-linux-arm64`：同源 release artifacts。

### 任务 1：L0 Cache 命中率契约

**文件：** 创建 `backend/internal/l0_axioms/cache_hit_rate.go`、`backend/internal/l0_axioms/cache_hit_rate_test.go`

- [ ] **步骤 1：编写失败测试**

```go
func TestCalculateCacheHitRatePercent(t *testing.T) {
  cases := []struct { name string; read, eligible int64; want float64 }{
    {"empty", 0, 0, 0}, {"no hit", 0, 100, 0},
    {"standard", 75, 100, 75}, {"upper bound", 120, 100, 100},
    {"negative", -1, 100, 0},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      if got := CalculateCacheHitRatePercent(tc.read, tc.eligible); got != tc.want {
        t.Fatalf("got %v, want %v", got, tc.want)
      }
    })
  }
}
```

- [ ] **步骤 2：运行 RED**

运行：`cd backend && go test ./internal/l0_axioms -run TestCalculateCacheHitRatePercent -v`  
预期：FAIL，`undefined: CalculateCacheHitRatePercent`。

- [ ] **步骤 3：最少实现**

```go
type TokenSummary struct {
  TotalTokens int64 `gorm:"column:total_tokens"`
  CacheReadTokens int64 `gorm:"column:cache_read_tokens"`
  CacheEligibleTokens int64 `gorm:"column:cache_eligible_tokens"`
}
func CalculateCacheHitRatePercent(read, eligible int64) float64 {
  if read <= 0 || eligible <= 0 { return 0 }
  if read >= eligible { return 100 }
  return float64(read) / float64(eligible) * 100
}
```

- [ ] **步骤 4：运行 GREEN 并提交**

运行：`cd backend && go test ./internal/l0_axioms -run TestCalculateCacheHitRatePercent -v`；预期 PASS。  
提交：`git add backend/internal/l0_axioms/cache_hit_rate* && git commit -m 'feat: 定义 Cache 命中率契约'`

### 任务 2：Backend summary 垂直链路

**文件：** 修改 `models.go`、`usage_query.go`、`metrics_aggregator.go`；创建两个对应测试文件；更新 `go.mod/go.sum`

- [ ] **步骤 1：加入 SQL mock 并编写 L1 失败测试**

运行：`cd backend && go get github.com/DATA-DOG/go-sqlmock@v1.5.2`

测试用 `sqlmock.New()` + `gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}))`，期待查询包含：

```sql
COALESCE(SUM(input_tokens + output_tokens), 0) AS total_tokens,
COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
COALESCE(SUM(input_tokens + cache_creation_tokens + cache_read_tokens), 0)
  AS cache_eligible_tokens
```

并期待 `WHERE user_id = $1`、参数 `int64(3)`；mock row 为 `900, 600, 800`，断言 `TokenSummary{900,600,800}`。

- [ ] **步骤 2：运行 L1 RED**

运行：`cd backend && go test ./internal/l1_blocks -run TestGetTokenSummary -v`  
预期：FAIL，`undefined: GetTokenSummary`。

- [ ] **步骤 3：实现一次聚合查询**

```go
func GetTokenSummary(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) (l0_axioms.TokenSummary, error) {
  var summary l0_axioms.TokenSummary
  query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
  selectSQL := "COALESCE(SUM" + tokenExpr(filter) + ", 0) AS total_tokens, " +
    "COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, " +
    "COALESCE(SUM(input_tokens + cache_creation_tokens + cache_read_tokens), 0) AS cache_eligible_tokens"
  if err := query.Select(selectSQL).Scan(&summary).Error; err != nil {
    return summary, fmt.Errorf("failed to query token summary: %w", err)
  }
  return summary, nil
}
```

保留 `GetTotalTokens` 暂作兼容 wrapper，直到 L2 切换完成。运行 L1 测试，预期 PASS。

- [ ] **步骤 4：编写 L2 失败测试**

用 sqlmock 依次返回 total cost、hourly cost、token summary、request count；调用 `AggregateSummaryMetrics`，断言：

```go
if got.CacheHitRate != 75 || got.TotalTokens != 900 { t.Fatalf(...) }
payload, _ := json.Marshal(got)
if !bytes.Contains(payload, []byte(`"cacheHitRate":75`)) { t.Fatalf(...) }
```

- [ ] **步骤 5：运行 L2 RED**

运行：`cd backend && go test ./internal/l2_flows -run TestAggregateSummaryMetricsIncludesCacheHitRate -v`  
预期：FAIL，`MetricsSummary` 没有 `CacheHitRate`。

- [ ] **步骤 6：完成 L2/API 实现并删除 wrapper**

在 `MetricsSummary` 增加 `CacheHitRate float64 json:"cacheHitRate"`；flow 调用 `GetTokenSummary`，设置：

```go
TotalTokens: tokenSummary.TotalTokens,
CacheHitRate: l0_axioms.CalculateCacheHitRatePercent(
  tokenSummary.CacheReadTokens, tokenSummary.CacheEligibleTokens,
),
```

删除无调用的 `GetTotalTokens`，运行 L1/L2 与 `cd backend && go test ./...`，预期全部 PASS。

- [ ] **步骤 7：提交 Backend**

`git add backend && git commit -m 'feat: 在 summary 返回 Cache 命中率'`

### 任务 3：Frontend 第 6 张指标卡

**文件：** 创建 `frontend/src/metrics/cacheHitRateDisplay.ts` 及测试；修改 `api/client.ts`、`views/Dashboard.vue`

- [ ] **步骤 1：编写显示规则失败测试**

```ts
expect(formatCacheHitRate(73.44)).toBe('73.4')
expect(formatCacheHitRate(Number.NaN)).toBe('0.0')
expect(formatCacheHitRate(120)).toBe('100.0')
```

运行：`cd frontend && npm test -- --run src/metrics/cacheHitRateDisplay.test.ts`  
预期：FAIL，模块不存在。

- [ ] **步骤 2：实现显示规则并运行 GREEN**

```ts
export function formatCacheHitRate(percent: number): string {
  if (!Number.isFinite(percent)) return '0.0'
  return Math.min(100, Math.max(0, percent)).toFixed(1)
}
```

运行同一测试，预期 PASS。

- [ ] **步骤 3：接入 API 与 Dashboard**

`MetricsSummaryResponse` 增加 `cacheHitRate: number`。Dashboard 导入 formatter，网格改为 `lg:grid-cols-3 xl:grid-cols-6`，在 Models 后增加：

```vue
<MetricCard title="Cache Hit Rate" :value="formatCacheHitRate(summary.cacheHitRate)" unit="%" />
```

- [ ] **步骤 4：验证并提交 Frontend source**

运行：`cd frontend && npm test -- --run && npm run build`；预期测试、`vue-tsc`、Vite build 全部成功。  
提交：`git add frontend/src && git commit -m 'feat: 展示 Cache 命中率卡片'`

### 任务 4：Release artifact 与最终验证

- [ ] 本地运行：`cd backend && go test ./...`、`cd frontend && npm test -- --run && npm run build`。
- [ ] 构建：`cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o sub2monitor-linux-arm64 ./cmd/server`。
- [ ] 检查 `frontend/dist/assets/` 无 `* 2.js`、`* 2.css`；运行 `git diff --check`。
- [ ] 用实际数据库执行公式 SQL，记录命中率；验证 `include_cache=true/false` 时该值相同、Scope 切换时按用户变化。
- [ ] 提交 artifacts：`git add frontend/dist backend/sub2monitor-linux-arm64 && git commit -m 'build: 更新 Cache 命中率 release artifacts'`。
- [ ] 运行 `git status --short --branch`，确认只有预期 commits 且工作区干净；本计划不执行生产部署。
