# Metric 数字容器防溢出设计

## 目标

修复 Dashboard `Requests` 卡片中 `success/total` 长数字溢出问题，并把防溢出契约下沉到所有 `MetricCard` 与 `RollingNumber` 使用点，避免未来新增长指标重复踩坑。

## 已确认根因

- summary 卡片在 `xl` 断点使用 6 列布局，单卡宽度变窄。
- CSS Grid item 默认 `min-width: auto`，长内容会撑大网格轨道。
- `MetricCard` 根节点没有 `min-w-0`，数值区没有 `max-width` 或 `overflow` 约束。
- `RollingNumber` 根节点是不可折行的 `inline-flex`，`Requests` 使用未 compact 的 `success/total` 字符串。

## 成功标准

- `Requests` 在窄卡片中不再穿出卡片边界。
- 数值优先保持完整，不用 ellipsis 截断正常长度的监控数字。
- 极端长值仍被容器裁切而不是撑破布局，并通过 `title` / `aria-label` 保留完整值。
- 所有 `MetricCard` 和 `RollingNumber` 使用点共享同一防溢出约束。
- 不修改 API、数字口径、刷新流程和 Dashboard 网格布局。

## 设计

### L1 积木层：Metric value presentation

创建 `frontend/src/metrics/metricValuePresentation.ts`：

```ts
export function metricValueFontSize(value: string): string {
  const length = Math.max(value.length, 1)
  const rem = Math.max(0.75, Math.min(1.75, 2.25 - length * 0.1))
  return `${rem.toFixed(2)}rem`
}
```

契约：

- 短值最大 `1.75rem`，长值逐步缩小，最小 `0.75rem`。
- 该函数只决定显示字号，不修改真实数值或 aria 文本。
- 对相同字符串纯函数返回相同结果，可独立测试。

### L1 积木层：MetricCard 边界

修改 `MetricCard.vue`：

- 卡片根节点增加 `min-w-0`，禁止 grid item 被内容撑开。
- 数值 wrapper 改为 `flex min-w-0 max-w-full overflow-hidden`。
- wrapper 使用 `metricValueFontSize(formattedValue)` 动态字号，并设置 `title` 为完整显示值。
- `RollingNumber` 使用可收缩、可裁切的 flex item；unit 使用 `shrink-0`，保证单位不被数字吞掉。

### L1 积木层：RollingNumber 边界

修改 `RollingNumber.vue` scoped style：

- 根节点增加 `min-width: 0`、`max-width: 100%`、`overflow: hidden`。
- 该边界覆盖 Hero、副标题和 MetricCard 中的所有 rolling number，不要求调用方逐个补 CSS。
- 现有 `aria-label` 保留完整字符串，减少视觉裁切对可访问性的影响。

## 数据流与错误处理

- 输入仍来自现有 `formattedValue`，不新增 API 字段。
- `null` / `undefined` 仍由 `MetricCard` 当前逻辑转换为字符串后处理。
- 超长字符串保持完整 aria/title；视觉层按最小字号并裁切，不允许撑破父容器。
- 不引入 ResizeObserver，避免动画期间的反复测量和布局抖动。

## 测试

新增 `metricValuePresentation.test.ts`：

- 短值返回 `1.75rem`。
- 中等长度字号下降。
- 长值和极长值都不低于 `0.75rem`。
- 相同输入结果稳定。

Frontend 全量验证：

```bash
cd frontend
npm test -- --run
npm run build
```

构建后用真实 Dashboard bundle 检查新 CSS/字号契约；部署后检查公网 HTML、新 hashed asset、容器健康状态和 asset SHA-256。

## 非目标

- 不把 `Requests` 单独改成 compact 数字格式。
- 不修改 `xl:grid-cols-6` 布局。
- 不改变 `RollingNumber` 的动画算法、时序和 reduced-motion 行为。
- 不修改 Backend 或数据库。
