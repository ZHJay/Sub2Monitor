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

    app.unmount()
  })
})
