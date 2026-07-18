// Layer: L1 积木层
// Boundary: stage/canvas motion only; caller owns Chart data writes.

export type StageMotionHandle = {
  /** Invalidate in-flight fades and remove snapshot overlays. */
  cancel: (resetOpacity?: boolean) => void
  /** Freeze current chart as overlay, apply swap underneath, fade overlay out. */
  playSnapshotCrossfade: (apply: () => void) => void
  resetTransform: () => void
  resetOpacity: () => void
  playSlideLeft: (shiftPx: number, durationMs: number) => void
}

/**
 * Create motion helpers bound to a chart stage host.
 * Why snapshot crossfade: live canvas CSS opacity and Chart.js morph are
 * unreliable across range/interval changes; a freeze-frame div always animates.
 */
export function createStageMotion(opts: {
  getStage: () => HTMLElement | null
  getChartImage: () => string | null
  crossfadeMs: number
}): StageMotionHandle {
  let fadeGen = 0
  let fadeTimer: number | null = null
  let slideTimer: number | null = null
  let overlayEl: HTMLDivElement | null = null

  function clearFadeTimer() {
    if (fadeTimer != null) {
      window.clearTimeout(fadeTimer)
      fadeTimer = null
    }
  }

  function clearSlideTimer() {
    if (slideTimer != null) {
      window.clearTimeout(slideTimer)
      slideTimer = null
    }
  }

  function removeOverlay() {
    overlayEl?.remove()
    overlayEl = null
  }

  function resetOpacity() {
    const stage = opts.getStage()
    if (!stage) return
    stage.style.transition = 'none'
    stage.style.opacity = '1'
  }

  function resetTransform() {
    const stage = opts.getStage()
    if (!stage) return
    stage.style.transition = 'none'
    stage.style.transform = 'translateX(0)'
  }

  function cancel(resetOpacityFlag = true) {
    fadeGen += 1
    clearFadeTimer()
    removeOverlay()
    if (resetOpacityFlag) resetOpacity()
  }

  function playSnapshotCrossfade(apply: () => void) {
    const stage = opts.getStage()
    const host = stage?.parentElement
    const gen = ++fadeGen
    clearFadeTimer()
    removeOverlay()

    if (!stage || !host) {
      apply()
      return
    }

    stage.style.transition = 'none'
    stage.style.opacity = '1'
    stage.style.transform = 'translateX(0)'

    const image = opts.getChartImage()
    if (!image) {
      apply()
      return
    }

    // Div + background-image: more reliable than <img> decode timing for data URLs.
    const overlay = document.createElement('div')
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:6',
      'pointer-events:none',
      'opacity:1',
      'background-repeat:no-repeat',
      'background-position:center',
      'background-size:100% 100%',
      // No transition yet — commit opaque frame first.
      'transition:none',
    ].join(';')
    // JSON.stringify quotes the data URL safely for CSS url("...")
    overlay.style.backgroundImage = `url(${JSON.stringify(image)})`
    host.appendChild(overlay)
    overlayEl = overlay

    // Force layout so the freeze-frame is painted before we swap the live chart.
    void overlay.offsetWidth

    apply()

    const startFade = () => {
      if (gen !== fadeGen || overlayEl !== overlay) return
      // Reflow, then enable transition and fade — avoids coalesced hard cut.
      void overlay.offsetWidth
      overlay.style.transition = `opacity ${opts.crossfadeMs}ms ease`
      requestAnimationFrame(() => {
        if (gen !== fadeGen || overlayEl !== overlay) return
        overlay.style.opacity = '0'
        fadeTimer = window.setTimeout(() => {
          if (overlayEl === overlay) removeOverlay()
          fadeTimer = null
        }, opts.crossfadeMs + 40)
      })
    }

    // Two frames: browser paints overlay + new canvas under it, then fade.
    requestAnimationFrame(() => {
      requestAnimationFrame(startFade)
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
    playSnapshotCrossfade,
    resetTransform,
    resetOpacity,
    playSlideLeft,
  }
}
