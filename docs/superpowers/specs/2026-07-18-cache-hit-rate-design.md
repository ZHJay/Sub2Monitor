# Cache Hit Rate 指标设计

## 目标

在 Sub2Monitor summary 区域增加第 6 张 `Cache Hit Rate` 指标卡，以 token 口径展示当前 Scope 的累计 cache 命中率。

成功标准：

- API summary 返回 `cacheHitRate`，单位为百分比，范围为 `0..100`。
- 指标跟随 `user_scope` / `user_email` 过滤。
- 指标不受 `include_cache` 开关影响；该开关只改变现有 token 汇总口径。
- Dashboard 显示一位小数，例如 `73.4%`。
- 卡片区在大屏为 3×2，在更宽屏为 6×1。
- 不为 30 秒自动刷新增加额外的 usage_logs 全表聚合查询。

## 指标口径

公式：

```text
cache_hit_rate_percent =
  SUM(cache_read_tokens)
  / SUM(input_tokens + cache_creation_tokens + cache_read_tokens)
  * 100
```

分母代表全部 prompt tokens，不包含 `output_tokens`。

边界契约：

- `cacheEligibleTokens <= 0` 或 `cacheReadTokens <= 0` 时返回 `0`。
- `cacheReadTokens >= cacheEligibleTokens` 时返回 `100`，防止异常数据导致 UI 越界。
- 其他情况返回未取整的 `float64` 百分比；显示层统一保留一位小数。

## API 契约

扩展现有接口：

```text
GET /api/metrics/summary
```

新增响应字段：

```json
{
  "cacheHitRate": 73.4
}
```

字段是 `0..100` 的百分比，不是 `0..1` 比率。现有响应字段和 endpoint 保持不变。

## 四层架构

### L0 公理层

在 `backend/internal/l0_axioms` 定义：

- `TokenSummary`：`TotalTokens`、`CacheReadTokens`、`CacheEligibleTokens`。
- `CalculateCacheHitRatePercent(cacheReadTokens, cacheEligibleTokens)`：纯规则，负责零分母与范围边界。
- `MetricsSummary.CacheHitRate`：对外 JSON 字段 `cacheHitRate`。

L0 仅依赖标准库和自身，不接触数据库。

### L1 积木层

在 `backend/internal/l1_blocks/usage_query.go` 将现有单值 token 查询改为一次 token summary 查询：

```sql
SELECT
  COALESCE(SUM(TokenTotalSQL 或 TokenNoCacheSQL), 0) AS total_tokens,
  COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
  COALESCE(SUM(input_tokens + cache_creation_tokens + cache_read_tokens), 0)
    AS cache_eligible_tokens
FROM usage_logs
WHERE user_id = ?; -- 仅在 Scope 指定用户时添加
```

`TokenSQL(include_cache)` 在构造查询时选择 `TokenTotalSQL` 或 `TokenNoCacheSQL`。`TotalTokens` 继续受 `include_cache` 控制；cache 两个聚合列不读取该开关。三列在同一次数据库扫描中返回。

### L2 流程层

`AggregateSummaryMetrics`：

1. 沿用现有 email → user_id 解析。
2. 获取 token summary。
3. 用 L0 规则计算 `CacheHitRate`。
4. 与成本、请求数、时间戳一起组装 summary。

数据库错误继续归一化为当前 summary flow 的 error。

### L3 边界 adapter

`GetMetricsSummary` 和路由保持不变。现有 handler 将扩展后的 summary 序列化为 JSON；不新增 endpoint 或 query 参数。

## Frontend

### 数据契约

`frontend/src/api/client.ts` 的 `MetricsSummaryResponse` 增加：

```ts
cacheHitRate: number
```

### 展示

`frontend/src/views/Dashboard.vue`：

- 在现有 `Models` 卡片后增加 `Cache Hit Rate`。
- 传入 `summary.cacheHitRate.toFixed(1)` 和 `%` 单位，避免 `MetricCard` 把小数格式化为整数。
- 卡片网格调整为：
  - 默认 1 列；
  - `sm` 2 列；
  - `lg` 3 列；
  - `xl` 6 列。

现有 Hero、Cache 开关、Scope 选择、图表、heatmap 和 SSO 行为不变。

## 错误处理

- token summary SQL 失败：summary flow 返回 error，现有 handler 返回 `500 Metrics temporarily unavailable`。
- 无 usage 数据：`cacheHitRate = 0`，不是 `NaN` 或 `null`。
- 异常负数或 numerator 大于 denominator：L0 规则将显示值限制在 `0..100`。

## TDD 与验证

按 vertical slice 执行 RED → GREEN → REFACTOR：

1. L0 规则测试先覆盖：零分母、零命中、标准比例、上界钳制。
2. token summary 查询测试先证明：
   - Scope 使用现有 `user_id` 过滤；
   - total token 表达式响应 `include_cache`；
   - cache read / eligible 表达式不响应 `include_cache`。
3. summary JSON 契约测试先证明 `cacheHitRate` 字段存在且单位为百分比。
4. Frontend 类型与 build 验证第 6 张卡片能编译。

最终命令：

```bash
cd backend && go test ./...
cd frontend && npm test -- --run
cd frontend && npm run build
```

真实数据核对使用同一 Scope 执行公式 SQL，并与 `/api/metrics/summary` 的 `cacheHitRate` 比较；允许的差异仅来自 UI 一位小数显示。

## 非目标

- 不增加按日或按模型的 cache 命中率图表。
- 不改变 `include_cache` 的现有 token 口径。
- 不修改 SSO、授权、refresh scheduler 或生产部署方式。
- 不部署到生产；部署作为独立操作处理。
