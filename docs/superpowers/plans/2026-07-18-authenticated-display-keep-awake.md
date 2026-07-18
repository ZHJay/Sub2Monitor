# 管理员会话常亮与持续刷新实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** admin 会话有效时保持屏幕常亮并持续按 30 秒 deadline 刷新；明确检测到 `401/403` 退出后释放并停止。

**架构：** 两个无 Vue 依赖的 L1 adapter 分别封装 Screen Wake Lock 和 refresh deadline；`App.vue` 与 `useDashboardMetrics` 仅编排生命周期。Wake Lock 不支持或临时失败时降级但不改变认证状态；刷新统一串行并在恢复可见、focus、online 后补刷。

**技术栈：** Vue 3、TypeScript、Vitest、Axios、Vite、Go runtime image、GitHub Actions 自动部署。

---

## 文件结构

- 创建 `frontend/src/display/screenWakeLock.ts`：L1 Screen Wake Lock 生命周期 adapter。
- 创建 `frontend/src/display/screenWakeLock.test.ts`：申请、重获、释放、降级测试。
- 创建 `frontend/src/refresh/refreshDeadlineScheduler.ts`：L1 串行 deadline refresh adapter。
- 创建 `frontend/src/refresh/refreshDeadlineScheduler.test.ts`：定时、去重、恢复补刷、清理测试。
- 修改 `frontend/src/App.vue`：认证状态驱动 Wake Lock。
- 修改 `frontend/src/composables/useDashboardMetrics.ts`：以 deadline scheduler 替换裸 `setInterval`。
- 更新 `frontend/dist/` 与 `backend/sub2monitor-linux-arm64`：同一源码版本的生产 artifact。

### 任务 1：Screen Wake Lock adapter

- [ ] **步骤 1：先写失败测试**

在 `frontend/src/display/screenWakeLock.test.ts` 使用 jsdom 和 fake sentinel，覆盖：

```ts
it('acquires while active and releases on stop', async () => {
  const sentinel = createSentinel()
  const request = vi.fn().mockResolvedValue(sentinel)
  const lock = createScreenWakeLock(documentPort, { request })
  await lock.start()
  expect(request).toHaveBeenCalledWith('screen')
  await lock.stop()
  expect(sentinel.release).toHaveBeenCalledOnce()
})

it('reacquires after browser release when visible and still active', async () => {
  const first = createSentinel()
  const second = createSentinel()
  const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const lock = createScreenWakeLock(documentPort, { request })
  await lock.start()
  first.emitRelease()
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
})

it('does not reacquire after authentication lifecycle stops', async () => {
  const sentinel = createSentinel()
  const request = vi.fn().mockResolvedValue(sentinel)
  const lock = createScreenWakeLock(documentPort, { request })
  await lock.start()
  await lock.stop()
  documentPort.emitVisibility('visible')
  expect(request).toHaveBeenCalledTimes(1)
})
```

另加 API 缺失和 `request()` reject 不抛出测试。

- [ ] **步骤 2：验证 RED**

运行：`cd frontend && npm test -- --run src/display/screenWakeLock.test.ts`

预期：FAIL，`./screenWakeLock` module 不存在。

- [ ] **步骤 3：写最少实现**

在 `screenWakeLock.ts` 定义：

```ts
export interface ScreenWakeLock {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createScreenWakeLock(
  page: VisibilityPagePort,
  wakeLock?: WakeLockPort,
): ScreenWakeLock

export function createBrowserScreenWakeLock(): ScreenWakeLock
```

实现 invariant：单 sentinel、单 in-flight request；`stop()` 先把 active 置 false，再释放；request race 在 inactive 时立即释放新 sentinel；`release` 和 visible 事件仅在 active 时重获。失败为静默降级，不修改认证状态。

- [ ] **步骤 4：验证 GREEN 并 commit**

运行：`cd frontend && npm test -- --run src/display/screenWakeLock.test.ts`

预期：测试全部 PASS。

```bash
git add frontend/src/display
 git commit -m "feat(display): keep authenticated dashboard awake"
```

### 任务 2：无漂移 refresh deadline scheduler

- [ ] **步骤 1：先写失败测试**

在 `frontend/src/refresh/refreshDeadlineScheduler.test.ts` 使用 `vi.useFakeTimers()`，覆盖：

```ts
it('refreshes immediately and again at the 30 second deadline', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined)
  const scheduler = createRefreshDeadlineScheduler(refresh, testEnvironment())
  scheduler.start()
  await vi.runAllTicks()
  expect(refresh).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(refresh).toHaveBeenCalledTimes(2)
})

it('serializes overlapping refresh requests into one queued rerun', async () => {
  const first = deferred<void>()
  const refresh = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
  const scheduler = createRefreshDeadlineScheduler(refresh, testEnvironment())
  scheduler.start()
  void scheduler.refreshNow()
  void scheduler.refreshNow()
  expect(refresh).toHaveBeenCalledTimes(1)
  first.resolve()
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
})

it('catches up once when a hidden page becomes visible after its deadline', async () => {
  const env = testEnvironment()
  const refresh = vi.fn().mockResolvedValue(undefined)
  const scheduler = createRefreshDeadlineScheduler(refresh, env)
  scheduler.start()
  await vi.runAllTicks()
  scheduler.stop()
  // A second active scheduler uses controlled now/event ports to simulate throttling.
  const active = createRefreshDeadlineScheduler(refresh, env)
  active.start()
  env.advanceWithoutTimers(31_000)
  env.page.emitVisibility('visible')
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(3))
})
```

另覆盖 focus、online、未到 deadline 不补刷、stop 后 timer/listener 无效、refresh reject 后仍继续调度。

- [ ] **步骤 2：验证 RED**

运行：`cd frontend && npm test -- --run src/refresh/refreshDeadlineScheduler.test.ts`

预期：FAIL，`./refreshDeadlineScheduler` module 不存在。

- [ ] **步骤 3：写最少实现**

在 `refreshDeadlineScheduler.ts` 定义：

```ts
export interface RefreshDeadlineScheduler {
  start(): void
  stop(): void
  refreshNow(): Promise<void>
}

export function createRefreshDeadlineScheduler(
  refresh: () => Promise<void>,
  environment?: RefreshSchedulerEnvironment,
): RefreshDeadlineScheduler
```

内部只保留 `running`、`timer`、`inFlight`、`rerunRequested`、`nextDeadlineMs`。每次完成后把 deadline 推进到第一个未来 tick；所有触发源共用一个执行入口；stop 后 in-flight settle 不得重排 timer。

- [ ] **步骤 4：验证 GREEN 并 commit**

运行：`cd frontend && npm test -- --run src/refresh/refreshDeadlineScheduler.test.ts`

预期：测试全部 PASS。

```bash
git add frontend/src/refresh
 git commit -m "feat(refresh): keep dashboard cadence active"
```

### 任务 3：接入认证与 dashboard 生命周期

- [ ] **步骤 1：修改 `App.vue`**

创建一次 `createBrowserScreenWakeLock()`；用 `watch(status, ...)` 在 `authenticated` 时 `start()`，其他状态 `stop()`；`onBeforeUnmount` 再 stop。`503` 仍保持 `unavailable` 的既有语义，不把它映射成 auth-lost。

- [ ] **步骤 2：修改 `useDashboardMetrics.ts`**

将现有 `refreshData()` 主体重命名为 `refreshDataOnce()`；创建 `refreshScheduler`；公开的 `refreshData()` 调用 `refreshScheduler.refreshNow()`。`onMounted(refreshScheduler.start)`、`onUnmounted(refreshScheduler.stop)` 替换 `setInterval`，筛选 watch 与 Refresh button 保持同一串行入口。

- [ ] **步骤 3：运行局部与全量验证**

```bash
cd frontend
npm test -- --run src/display/screenWakeLock.test.ts src/refresh/refreshDeadlineScheduler.test.ts
npm test -- --run
npm run build
```

预期：全部测试 PASS；`vue-tsc` 与 Vite build exit 0。

- [ ] **步骤 4：四层与文件检查并 commit**

```bash
wc -l frontend/src/display/screenWakeLock.ts frontend/src/refresh/refreshDeadlineScheduler.ts frontend/src/App.vue frontend/src/composables/useDashboardMetrics.ts
git diff --check
git add frontend/src frontend/dist
 git commit -m "feat: keep admin monitor awake and refreshing"
```

预期：新增手写文件各不超过 200 行，无模糊桶命名，无反向依赖。

### 任务 4：发布 artifact、代码审查与生产部署

- [ ] **步骤 1：重建并验证 ARM64 backend artifact**

```bash
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -o sub2monitor-linux-arm64 ./cmd/server
 go test ./...
 go vet ./...
cd ..
git add backend/sub2monitor-linux-arm64 frontend/dist
git commit -m "build: refresh Sub2Monitor release artifacts"
```

- [ ] **步骤 2：完成 code review 与最终验证**

运行 source diff review，核对 auth-lost 唯一释放路径、`503` 不释放、timer 与 event listener 清理、构建 artifact 无 `* 2.js/css`。然后重新运行：

```bash
cd frontend && npm test -- --run && npm run build
cd ../backend && go test ./... && go vet ./...
git diff --check && git status --short
```

- [ ] **步骤 3：推送并等待 GitHub Actions 自动部署**

```bash
git push origin main
 gh run list --workflow deploy-sub2monitor.yml --limit 1
 gh run watch <run-id> --exit-status
```

- [ ] **步骤 4：生产验收**

核对公网 HTML 的 hashed JS/CSS 均为 200；JS 含 Wake Lock 与 deadline scheduler 代码；`/health` 为 200；未登录 metrics 为 `401/403`；SSH 到大站确认 `sub2monitor` healthy、容器 artifact SHA 与本地一致，且 sub2api 容器 ID/StartedAt 未变化。
