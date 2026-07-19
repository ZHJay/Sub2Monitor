# Monitor 刷新自动 SSO 设计

## 背景与目标

Sub2Monitor 从 Sub2API SSO Bridge 返回时，URL 会包含一次性结果参数 `sso`。现有前端只要发现该参数，就会在 Monitor session 校验失败后禁止再次跳转，以避免 SSO 返回页形成重定向循环。由于参数一直留在 URL 中，用户之后刷新页面仍会被当作“刚从 Bridge 返回”，只能点击“重试”再次登录。

目标是让用户刷新 Monitor 页面时自动恢复登录：如果现有 Monitor session 有效，直接显示仪表盘；如果 session 已失效但 Sub2API 登录态仍有效，自动完成一次同页 SSO 往返并返回仪表盘。同时必须继续防止 Bridge 返回失败时的无限重定向。

## 方案

把 `sso` 查询参数视为一次性返回结果，在页面首次处理时读取并立即从地址栏中移除。

1. 页面挂载时读取当前 URL 是否包含 `sso`。
2. 如果包含，执行一次 Monitor session 校验，但本次校验失败后不再自动启动 SSO，避免刚从 Bridge 返回就再次跳转。
3. 使用 `history.replaceState` 删除 `sso` 参数，保留路径、其他查询参数和 hash，不增加浏览历史。
4. 如果后续刷新时 URL 已不包含 `sso`，Monitor session 校验失败会按现有流程创建 challenge，并跳转 Sub2API Bridge。
5. “重试”按钮保持原行为，供未登录、权限不足或临时故障时人工再次尝试。

不使用 `sessionStorage` 保存尝试次数，因为 URL 本身已经携带完整的一次性状态；也不增加定时自动重试，以免身份服务异常时产生反复请求或跳转。

## 组件与数据流

改动仅限 `frontend/src/App.vue` 的鉴权入口，并在同一文件附近保留清晰的小型 URL 处理函数：

- 输入：当前 `window.location`。
- 输出：本次是否允许自动跳转 SSO。
- 副作用：仅当存在 `sso` 参数时调用一次 `window.history.replaceState` 清除该参数。

数据流如下：

1. 读取并消费 Bridge 结果参数。
2. 调用 `getSSOSession()`。
3. session 有效：进入 `authenticated`。
4. session 无效且本次来自 Bridge：显示对应的匿名或不可用状态，不跳转。
5. session 无效且不是 Bridge 返回：创建 SSO challenge，跳转 Bridge。

后台 SSO challenge、exchange、session cookie 和权限校验协议均不改变。

## 错误处理

- `GET /api/auth/sso/session` 返回 503：显示身份服务暂不可用，不自动跳转。
- Bridge 返回 `sso=unavailable` 且 session 校验失败：显示不可用状态。
- Bridge 返回其他结果且 session 校验失败：显示登录提示和“重试”按钮。
- 非 Bridge 的普通刷新且 session 校验失败：只启动一次现有 SSO 流程。
- 删除 `sso` 参数时保留所有其他查询参数和 hash，避免破坏未来的页面状态。

## 测试与验收

先增加前端回归测试并确认在现有实现上失败，再写最小实现使其通过。

自动化测试覆盖：

1. `?sso=complete` 首次返回且 session 不存在时，不创建 challenge、不启动 Bridge，并从 URL 删除 `sso`。
2. 保留其他查询参数与 hash。
3. 模拟一次后续刷新；session 不存在时自动创建 challenge 并启动 Bridge。
4. session 有效时直接显示仪表盘，不启动 Bridge。
5. 现有前端测试、类型检查和生产构建全部通过。

实际验收流程：打开 Monitor，确保 Sub2API 已登录，令 Monitor session 失效或重启 Monitor 后刷新页面；页面应自动往返 Bridge 并进入仪表盘，无需点击“重试”，且不出现连续重定向。
