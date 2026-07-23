/** @vitest-environment jsdom */

import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ModelStatsTable from './ModelStatsTable.vue'

const sampleStats = [
  { model: 'beta', cost: 2, tokens: 10_000, requests: 30 },
  { model: 'alpha', cost: 5, tokens: 2_000, requests: 90 },
  { model: 'gamma', cost: 1, tokens: 50_000, requests: 10 },
]

describe('ModelStatsTable sorting', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  function mountTable() {
    const app = createApp(ModelStatsTable, { stats: sampleStats })
    app.mount(host)
    return app
  }

  function rowModels(): string[] {
    return [...host.querySelectorAll('tbody tr')].map((row) =>
      row.querySelector('td')?.textContent?.trim() ?? '',
    )
  }

  function headerButtons(): HTMLButtonElement[] {
    return [...host.querySelectorAll<HTMLButtonElement>('thead button')]
  }

  it('sorts by cost descending by default and exposes every column as a sort button', () => {
    const app = mountTable()

    expect(rowModels()).toEqual(['alpha', 'beta', 'gamma'])
    expect(headerButtons().map((button) => button.textContent?.trim())).toEqual([
      'Model',
      'Cost ↓',
      'Tokens',
      'Requests',
    ])

    app.unmount()
  })

  it('toggles text and numeric columns between ascending and descending order', async () => {
    const app = mountTable()
    const [modelButton,, tokensButton, requestsButton] = headerButtons()

    modelButton.click()
    await nextTick()
    expect(rowModels()).toEqual(['alpha', 'beta', 'gamma'])
    expect(modelButton.getAttribute('aria-sort')).toBe('ascending')

    modelButton.click()
    await nextTick()
    expect(rowModels()).toEqual(['gamma', 'beta', 'alpha'])
    expect(modelButton.getAttribute('aria-sort')).toBe('descending')

    tokensButton.click()
    await nextTick()
    expect(rowModels()).toEqual(['gamma', 'beta', 'alpha'])
    expect(tokensButton.getAttribute('aria-sort')).toBe('descending')

    requestsButton.click()
    await nextTick()
    expect(rowModels()).toEqual(['alpha', 'beta', 'gamma'])
    expect(requestsButton.getAttribute('aria-sort')).toBe('descending')

    requestsButton.click()
    await nextTick()
    expect(rowModels()).toEqual(['gamma', 'beta', 'alpha'])
    expect(requestsButton.getAttribute('aria-sort')).toBe('ascending')

    app.unmount()
  })
})
