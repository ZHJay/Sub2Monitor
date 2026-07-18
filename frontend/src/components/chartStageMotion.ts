// Layer: L1 积木层
// Boundary: stage/canvas motion only; caller owns Chart data writes.

export type StageMotionHandle = {
  cancel: () => void
  /** Fade host out → apply() → fade host in via Web Animations API. */
  playFadeSwap: (apply: () => void) => void
  resetTransform: () => void
  resetOpacity: () => void
  playSlideLeft: (shiftPx: number, durationMs: number) => void
}

/**
 * Motion helpers.
 * Why WAAPI on the stage element: CSS transition + snapshot overlays kept
 * failing silently in production; Element.animate is explicit and visible.
 */
export function createStageMotion(opts: {
  getStage: () => HTMLElement | null
  crossfadeMs: number
}): StageMotionHandle {
  let fadeGen = 0
  let slideTimer: number | null = null
  let activeAnim: Animation | null = null

  function clearSlideTimer() {
    if (slideTimer != null) {
      window.clearTimeout(slideTimer)
      slideTimer = null
    }
  }

  function stopAnim() {
    try {
      activeAnim?.cancel()
    } catch {
      /* ignore */
    }
    activeAnim = null
  }

  function resetOpacity() {
    const stage = opts.getStage()
    if (!stage) return
    stopAnim()
    stage.style.opacity = '1'
  }

  function resetTransform() {
    const stage = opts.getStage()
    if (!stage) return
    stage.style.transition = 'none'
    stage.style.transform = 'translateX(0)'
  }

  function cancel() {
    fadeGen += 1
    clearSlideTimer()
    resetOpacity()
    resetTransform()
  }

  function animateOpacity(el: HTMLElement, from: number, to: number, duration: number): Promise<void> {
    stopAnim()
    el.style.opacity = String(from)
    const anim = el.animate(
      [{ opacity: from }, { opacity: to }],
      { duration, easing: 'ease', fill: 'forwards' },
    )
    activeAnim = anim
    return anim.finished.then(() => {
      el.style.opacity = String(to)
      if (activeAnim === anim) activeAnim = null
      try {
        anim.cancel() // clear WAAPI effect; inline opacity remains
      } catch {
        /* ignore */
      }
    }).catch(() => {
      el.style.opacity = String(to)
      if (activeAnim === anim) activeAnim = null
    })
  }

  function playFadeSwap(apply: () => void) {
    const stage = opts.getStage()
    const gen = ++fadeGen
    if (!stage) {
      apply()
      return
    }

    stage.style.transform = 'translateX(0)'
    void animateOpacity(stage, 1, 0, opts.crossfadeMs).then(() => {
      if (gen !== fadeGen) return
      apply()
      // Next frame so Chart.js can paint before fade-in.
      requestAnimationFrame(() => {
        if (gen !== fadeGen) return
        void animateOpacity(stage, 0, 1, opts.crossfadeMs)
      })
    })
  }

  function playSlideLeft(shiftPx: number, durationMs: number) {
    const stage = opts.getStage()
    if (!stage || shiftPx <= 0) return
    clearSlideTimer()
    stage.style.transition = 'none'
    stage.style.transform = `translateX(${shiftPx}px)`
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = opts.getStage()
        if (!el) return
        el.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
        el.style.transform = 'translateX(0)'
        slideTimer = window.setTimeout(() => {
          resetTransform()
          slideTimer = null
        }, durationMs + 40)
      })
    })
  }

  return {
    cancel,
    playFadeSwap,
    resetTransform,
    resetOpacity,
    playSlideLeft,
  }
}
