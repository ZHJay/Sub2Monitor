# Metric 数字容器防溢出实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 Requests 长数字溢出，并让所有 MetricCard / RollingNumber 使用点具备统一宽度约束和自适应字号。

**架构：** 前端 L1 纯函数根据显示字符串长度计算受限字号；MetricCard 负责 grid item 与数值 wrapper 的边界；RollingNumber 负责所有调用点的最后一道裁切保护。API、Backend、动画算法和 Dashboard 网格不变。

**技术栈：** Vue 3、TypeScript、Vitest、Tailwind CSS、Vite。

---

## 文件结构

- 创建 `frontend/src/metrics/metricValuePresentation.ts`：数值字号纯规则。
- 创建 `frontend/src/metrics/metricValuePresentation.test.ts`：短/中/长字符串边界测试。
- 创建 `frontend/src/components/metricOverflowContract.test.ts`：通用 SFC 宽度边界回归测试。
- 修改 `frontend/src/components/MetricCard.vue`：grid item、数值 wrapper、自适应字号和完整值 title。
- 修改 `frontend/src/components/RollingNumber.vue`：全局 rolling number 宽度/裁切边界。
- 更新 `frontend/dist/`：同源生产 bundle。

### 任务 1：自适应字号纯规则

**文件：** 创建 `frontend/src/metrics/metricValuePresentation.ts`、`frontend/src/metrics/metricValuePresentation.test.ts`

- [ ] **步骤 1：编写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { metricValueFontSize } from './metricValuePresentation'

describe('metricValueFontSize', () => {
  it('keeps short values at the maximum size', () => {
    expect(metricValueFontSize('12345')).toBe('1.75rem')
  })
  it('shrinks medium values deterministically', () => {
    expect(metricValueFontSize('1234567890')).toBe('1.25rem')
  })
  it('clamps long values at the readable minimum', () => {
    expect(metricValueFontSize('123456789/123456789')).toBe('0.75rem')
    expect(metricValueFontSize('9'.repeat(100))).toBe('0.75rem')
  })
})
```

- [ ] **步骤 2：运行 RED**

运行：`cd frontend && npm test -- --run src/metrics/metricValuePresentation.test.ts`  
预期：FAIL，`metricValuePresentation` 模块不存在。

- [ ] **步骤 3：最少实现**

```ts
const MIN_METRIC_FONT_REM = 0.75
const MAX_METRIC_FONT_REM = 1.75

export function metricValueFontSize(value: string): string {
  const length = Math.max(value.length, 1)
  const rem = Math.max(
    MIN_METRIC_FONT_REM,
    Math.min(MAX_METRIC_FONT_REM, 2.25 - length * 0.1),
  )
  return `${rem.toFixed(2)}rem`
}
```

- [ ] **步骤 4：运行 GREEN 并提交**

运行同一测试，预期 3 tests PASS。  
提交：`git add frontend/src/metrics/metricValuePresentation* && git commit -m 'fix: 增加 Metric 自适应字号规则（任务 1/3）'`

### 任务 2：通用容器边界

**文件：** 创建 `frontend/src/components/metricOverflowContract.test.ts`；修改 `MetricCard.vue`、`RollingNumber.vue`

- [ ] **步骤 1：编写失败的 SFC 契约测试**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const metricCard = readFileSync(new URL('./MetricCard.vue', import.meta.url), 'utf8')
const rollingNumber = readFileSync(new URL('./RollingNumber.vue', import.meta.url), 'utf8')

describe('metric overflow contract', () => {
  it('contains every metric card within its grid track', () => {
    expect(metricCard).toContain('min-w-0')
    expect(metricCard).toContain('max-w-full')
    expect(metricCard).toContain('overflow-hidden')
    expect(metricCard).toContain('metricValueFontSize(formattedValue)')
  })
  it('contains every rolling number within its parent', () => {
    expect(rollingNumber).toContain('min-width: 0')
    expect(rollingNumber).toContain('max-width: 100%')
    expect(rollingNumber).toContain('overflow: hidden')
  })
})
```

- [ ] **步骤 2：运行 RED**

运行：`cd frontend && npm test -- --run src/components/metricOverflowContract.test.ts`  
预期：2 tests FAIL，当前 SFC 缺少通用边界。

- [ ] **步骤 3：修改 MetricCard**

根节点增加 `min-w-0`；数值区替换为：

```vue
<div
  class="mt-2 flex min-w-0 max-w-full items-baseline overflow-hidden font-semibold tracking-tight text-apple-text"
  :style="{ fontSize: metricValueFontSize(formattedValue) }"
  :title="formattedValue"
>
  <RollingNumber class="min-w-0 max-w-full shrink overflow-hidden" :value="formattedValue" />
  <span v-if="unit" class="ml-1 shrink-0 text-base font-medium text-apple-muted">{{ unit }}</span>
</div>
```

脚本导入：

```ts
import { metricValueFontSize } from '../metrics/metricValuePresentation'
```

- [ ] **步骤 4：修改 RollingNumber 最终边界**

在 `.rolling-number` 增加：

```css
min-width: 0;
max-width: 100%;
overflow: hidden;
```

- [ ] **步骤 5：运行 GREEN、全测和构建**

```bash
cd frontend
npm test -- --run src/components/metricOverflowContract.test.ts
npm test -- --run
npm run build
```

预期：契约测试 2/2、全量测试与 `vue-tsc`/Vite build 全部 PASS。

- [ ] **步骤 6：提交 source**

`git add frontend/src && git commit -m 'fix: 约束 Metric 数字容器溢出（任务 2/3）'`

### 任务 3：Release artifact、视觉验收与交付

- [ ] 重新运行 `cd frontend && npm test -- --run && npm run build`，确认生成唯一一组 hashed JS/CSS。
- [ ] 检查 `frontend/dist/assets/` 没有 `* 2.js`、`* 2.css`，且 bundle 包含 `metricValueFontSize` 对应计算与防溢出 CSS。
- [ ] 提交 dist：`git add frontend/dist && git commit -m 'build: 更新 Metric 防溢出 frontend artifact（任务 3/3）'`。
- [ ] 运行 `git diff --check` 和 `git status --short --branch`，确认工作区干净。
- [ ] 在本地或独立浏览器 fixture 中使用长 Requests 值验证：卡片 `scrollWidth <= clientWidth`，短数字仍保持正常字号。
- [ ] 获得用户明确确认后再 `git push origin main`；等待 `Deploy Sub2Monitor` Actions 成功。
- [ ] 部署后核对公网 HTML 新 hashed asset、`/health`、容器健康和公网/容器/本地 asset SHA-256 一致。
