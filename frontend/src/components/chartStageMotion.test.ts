/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStageMotion } from './chartStageMotion'

// Layer: L1 积木层 tests — range WAAPI fade ownership.

describe('createStageMotion.playFadeSwap', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('calls apply immediately when stage is missing', () => {
    const motion = createStageMotion({
      getStage: () => null,
      crossfadeMs: 80,
    })
    let applied = false
    motion.playFadeSwap(() => {
      applied = true
    })
    expect(applied).toBe(true)
  })

  it('re-asserts opacity 0 after apply before fade-in (Vue style flash defense)', async () => {
    const stage = document.createElement('div')
    document.body.appendChild(stage)
    stage.style.opacity = '1'

    // jsdom may not implement full WAAPI; stub animate to resolve after a tick.
    const animateMock = vi.fn((keyframes: Keyframe[], _opts?: KeyframeAnimationOptions) => {
      const to = Number((keyframes[keyframes.length - 1] as { opacity?: number }).opacity ?? 1)
      stage.style.opacity = String(to)
      return {
        finished: Promise.resolve(),
        cancel: () => undefined,
      } as unknown as Animation
    })
    stage.animate = animateMock

    const motion = createStageMotion({
      getStage: () => stage,
      crossfadeMs: 50,
    })

    let applied = false
    motion.playFadeSwap(() => {
      applied = true
      // Simulate old Vue FULL_PROPS re-applying style:{opacity:'1'} inside apply.
      stage.style.opacity = '1'
    })

    // Allow fade-out promise + double rAF chain.
    await vi.waitFor(() => expect(applied).toBe(true))
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    // Fade-in leg must start from 0: either last animate call is 0→1, or host held at 0.
    expect(animateMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    const lastCall = animateMock.mock.calls[animateMock.mock.calls.length - 1]
    const from = Number((lastCall[0] as Keyframe[])[0].opacity)
    const to = Number((lastCall[0] as Keyframe[])[1].opacity)
    expect(from).toBe(0)
    expect(to).toBe(1)
  })
})
