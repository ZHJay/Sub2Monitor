/** @vitest-environment jsdom */

import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { createSSOChallenge, getSSOSession } from './api/client'
import { startTopLevelSSO } from './auth/sub2apiSsoBridge'

vi.mock('./api/client', () => ({
  createSSOChallenge: vi.fn(),
  getSSOSession: vi.fn(),
}))

vi.mock('./auth/sub2apiSsoBridge', () => ({
  startTopLevelSSO: vi.fn(),
}))

vi.mock('./views/Dashboard.vue', () => ({
  default: { template: '<main>Dashboard</main>' },
}))

describe('App authentication gate', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    vi.mocked(getSSOSession).mockRejectedValue({ response: { status: 401 } })
    vi.mocked(createSSOChallenge).mockResolvedValue('fresh-state')
    window.history.replaceState({}, '', '/?sso=complete')
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    vi.clearAllMocks()
    document.body.replaceChildren()
  })

  it('stops automatic SSO after a bridge return without a session', async () => {
    const app = createApp(App)
    app.mount(host)

    await vi.waitFor(() => expect(getSSOSession).toHaveBeenCalledOnce())
    await nextTick()

    expect(createSSOChallenge).not.toHaveBeenCalled()
    expect(startTopLevelSSO).not.toHaveBeenCalled()
    expect(host.textContent).toContain('请先在 Sub2API 登录管理员账户')
    expect(window.location.search).toBe('')

    app.unmount()
  })

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
})
