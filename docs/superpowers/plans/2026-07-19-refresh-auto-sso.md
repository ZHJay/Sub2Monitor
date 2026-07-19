# Monitor Refresh Auto SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a normal Monitor page refresh automatically restore authentication through the existing Sub2API SSO Bridge without requiring the user to click “重试”.

**Architecture:** Treat the Bridge `sso` query parameter as a one-shot return result. `App.vue` captures and removes it before checking the Monitor session, passes the captured value into the existing authentication state machine for the current mount, and allows the next real refresh to start SSO automatically.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest 2 with jsdom, Vite 5.

## Global Constraints

- Do not change the backend SSO challenge, exchange, session cookie, or authorization protocol.
- A mount that arrives directly from the Bridge must not redirect to the Bridge again when its Monitor session check fails.
- Removing `sso` must preserve the current pathname, every other query parameter, and the URL hash.
- A later refresh with no `sso` parameter must retain the existing automatic challenge-and-redirect behavior.
- Keep the existing “重试” button as a manual fallback.
- Do not add storage, timers, retries, or new dependencies.

---

### Task 1: Consume the Bridge result exactly once

**Files:**
- Modify: `frontend/src/App.test.ts:3-47`
- Modify: `frontend/src/App.vue:57-81`

**Interfaces:**
- Consumes: `window.location`, `window.history.replaceState`, `getSSOSession(): Promise<void>`, `createSSOChallenge(): Promise<string>`, and `startTopLevelSSO(state: string): void`.
- Produces: `consumeSSOReturn(): string | null` and `startAuthentication(allowRedirect?: boolean, ssoResult?: string | null): Promise<void>` inside `App.vue`.

- [x] **Step 1: Make the Dashboard harmless in the authentication-gate unit tests**

Add this module mock below the existing SSO Bridge mock in `frontend/src/App.test.ts` so the authenticated branch can be asserted without starting dashboard data requests:

```ts
vi.mock('./views/Dashboard.vue', () => ({
  default: { template: '<main>Dashboard</main>' },
}))
```

- [x] **Step 2: Write the failing one-shot URL tests**

Extend the existing Bridge-return test with the URL assertion:

```ts
expect(window.location.search).toBe('')
```

Add these tests to `frontend/src/App.test.ts`:

```ts
it('preserves unrelated URL state while consuming an unavailable bridge result', async () => {
  window.history.replaceState({}, '', '/monitor?view=compact&sso=unavailable#metrics')
  const app = createApp(App)
  app.mount(host)

  await vi.waitFor(() => expect(getSSOSession).toHaveBeenCalledOnce())
  await nextTick()

  expect(window.location.pathname).toBe('/monitor')
  expect(window.location.search).toBe('?view=compact')
  expect(window.location.hash).toBe('#metrics')
  expect(host.textContent).toContain('身份服务暂时不可用')

  app.unmount()
})

it('starts SSO automatically on the next refresh after consuming a bridge result', async () => {
  const firstMount = createApp(App)
  firstMount.mount(host)
  await vi.waitFor(() => expect(getSSOSession).toHaveBeenCalledOnce())
  firstMount.unmount()

  const refreshedMount = createApp(App)
  refreshedMount.mount(host)

  await vi.waitFor(() => expect(getSSOSession).toHaveBeenCalledTimes(2))
  await vi.waitFor(() => expect(createSSOChallenge).toHaveBeenCalledOnce())
  expect(startTopLevelSSO).toHaveBeenCalledWith('fresh-state')

  refreshedMount.unmount()
})

it('shows the dashboard immediately when the monitor session is valid', async () => {
  window.history.replaceState({}, '', '/')
  vi.mocked(getSSOSession).mockResolvedValueOnce(undefined)
  const app = createApp(App)
  app.mount(host)

  await vi.waitFor(() => expect(host.textContent).toContain('Dashboard'))

  expect(createSSOChallenge).not.toHaveBeenCalled()
  expect(startTopLevelSSO).not.toHaveBeenCalled()

  app.unmount()
})
```

- [x] **Step 3: Run the focused test and verify RED**

Run:

```bash
cd frontend && npm test -- --run src/App.test.ts
```

Expected: the existing implementation fails because `window.location.search` still contains `sso`, unrelated URL state is not cleaned, and the second mount still suppresses `createSSOChallenge`.

- [x] **Step 4: Implement one-shot Bridge-result consumption**

Replace the authentication functions and mount callback in `frontend/src/App.vue` with:

```ts
function consumeSSOReturn(): string | null {
  const url = new URL(window.location.href)
  const ssoResult = url.searchParams.get('sso')
  if (ssoResult === null) return null

  url.searchParams.delete('sso')
  const query = url.searchParams.toString()
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${query ? `?${query}` : ''}${url.hash}`,
  )
  return ssoResult
}

async function startAuthentication(allowRedirect = true, ssoResult: string | null = null) {
  status.value = 'checking'
  try {
    await getSSOSession()
    status.value = 'authenticated'
  } catch (error: any) {
    if (error.response?.status === 503) { status.value = 'unavailable'; return }
    if (!allowRedirect) {
      status.value = ssoResult === 'unavailable' ? 'unavailable' : 'anonymous'
      return
    }
    try {
      startTopLevelSSO(await createSSOChallenge())
    } catch (challengeError: any) {
      status.value = challengeError.response?.status === 503 ? 'unavailable' : 'anonymous'
    }
  }
}

function authenticationLost() { status.value = 'anonymous' }
onMounted(() => {
  window.addEventListener('apimonitor:auth-lost', authenticationLost)
  const ssoResult = consumeSSOReturn()
  startAuthentication(ssoResult === null, ssoResult)
})
onBeforeUnmount(() => window.removeEventListener('apimonitor:auth-lost', authenticationLost))
```

- [x] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
cd frontend && npm test -- --run src/App.test.ts
```

Expected: `4` tests pass with no unhandled errors or warnings.

- [x] **Step 6: Review the minimal diff**

Run:

```bash
git diff --check
git diff -- frontend/src/App.vue frontend/src/App.test.ts
```

Expected: no whitespace errors; the production diff is limited to capturing/removing `sso` and passing the captured result into the existing state machine.

### Task 2: Verify the frontend and refresh the production artifact

**Files:**
- Modify: `frontend/dist/index.html`
- Create: the Vite-generated hashed JavaScript asset under `frontend/dist/assets/`
- Delete: `frontend/dist/assets/index-CFQWq5Up.js` after Vite replaces it

**Interfaces:**
- Consumes: the verified Vue source from Task 1 and the existing `frontend/package-lock.json` dependency graph.
- Produces: a type-checked Vite production bundle used by `Dockerfile.runtime`.

- [x] **Step 1: Run the complete frontend test suite**

Run:

```bash
cd frontend && npm test -- --run
```

Expected: all Vitest files and tests pass; zero failed tests.

- [x] **Step 2: Run type checking and create the production bundle**

Run:

```bash
cd frontend && npm run build
```

Expected: `vue-tsc` and `vite build` exit with status `0`, and `frontend/dist/index.html` references the newly hashed JavaScript asset.

- [x] **Step 3: Verify repository integrity after the build**

Run:

```bash
git diff --check
git status --short
```

Expected: only `frontend/src/App.vue`, `frontend/src/App.test.ts`, this plan document, and the expected Vite asset replacement are changed.

- [x] **Step 4: Commit the tested implementation and release artifact**

Run:

```bash
git add frontend/src/App.vue frontend/src/App.test.ts frontend/dist docs/superpowers/plans/2026-07-19-refresh-auto-sso.md
git commit -m "fix: retry monitor SSO automatically after refresh"
```

Expected: one commit containing the regression tests, minimal frontend fix, implementation plan, and matching production asset.

### Task 3: Rendered refresh-flow QA

**Files:**
- Inspect only: built frontend and the deployed Monitor page.
- Store temporary screenshots outside the repository under `/tmp`.

**Interfaces:**
- Consumes: the Browser plugin, the built frontend, and `https://monitor.api4kimi8.org/` when deployment access is available.
- Produces: page identity, DOM, console, screenshot, and interaction evidence for the refresh authentication flow.

- [x] **Step 1: Start the built frontend preview**

Run:

```bash
cd frontend && npm run preview -- --host 127.0.0.1 --port 4173
```

Expected: Vite serves the built frontend at `http://127.0.0.1:4173/`.

- [x] **Step 2: Exercise the local Bridge-return state**

Using the Browser plugin, navigate to:

```text
http://127.0.0.1:4173/?view=compact&sso=unavailable#metrics
```

Verify page identity, non-blank content, absence of a framework error overlay, relevant console health, and screenshot evidence. After mount, the address bar must end in `/?view=compact#metrics`, and the page must show the temporary-unavailable message without repeatedly navigating.

- [x] **Step 3: Exercise the deployed refresh flow after deployment**

On `https://monitor.api4kimi8.org/`, invalidate only the Monitor session by restarting its container or allowing its in-memory session to expire while keeping the Sub2API browser login active. Refresh once and verify the flow under test:

```text
Monitor refresh -> one Sub2API Bridge round-trip -> Monitor dashboard renders
```

Collect the final URL, DOM snapshot, console warnings/errors, interaction result, and screenshot. Confirm no “重试” click was used and no redirect loop occurred.

## Remote Deployment Result

The large-server key was resolved from the unified `/Users/zhanghjay/Desktop/KEYS` directory. The release was deployed to the existing Compose project without resetting its pre-existing working-tree changes. The container reported `running healthy`, the new `index-CxXxMRo2.js` asset returned HTTP `200`, browser QA confirmed that refresh automatically performed a Bridge round-trip and removed the one-shot `sso` result, and the user confirmed successful automatic login from an already authenticated Sub2API browser.
