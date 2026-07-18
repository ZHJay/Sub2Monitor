// Layer: L1 积木层
// Boundary: stage/canvas motion only; caller owns Chart data writes.

export type StageMotionHandle = {
  /** Invalidate in-flight fades and remove snapshot overlays. */
  cancel: (resetOpacity?: boolean) => void
  /** Fade-out freeze-frame of current chart, apply swap underneath, reveal new chart. */
  playSnapshotCrossfade: (apply: () => void) => void
  resetTransform: () => void
  resetOpacity: () => void
  playSlideLeft: (shiftPx: number, durationMs: number) => void
}

/**
 * Create motion helpers bound to a chart stage host.
 * Why snapshot crossfade: CSS opacity on a live Chart.js canvas was unreliable
 * (transition coalesced / gen races → hard cut). A freeze-frame img always animates.
 */
export function createStageMotion(opts: {
  getStage: () => HTMLElement | null
  getChartImage: () => string | null
  crossfadeMs: number
}): StageMotionHandle {
  let fadeGen = 0
  let fadeTimer: number | null = null
  let slideTimer: number | null = null
  let overlayEl: HTMLImageElement | null = null

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

    // Always keep the live stage fully visible under the overlay.
    stage.style.transition = 'none'
    stage.style.opacity = '1'

    const image = opts.getChartImage()
    if (!image) {
      apply()
      return
    }

    const overlay = document.createElement('img')
    overlay.src = image
    overlay.alt = ''
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'object-fit:fill',
      'pointer-events:none',
      'z-index:5',
      'opacity:1',
      `transition:opacity ${opts.crossfadeMs}ms ease`,
    ].join(';')
    host.appendChild(overlay)
    overlayEl = overlay

    // Swap chart data under the freeze-frame (user still sees old image).
    apply()

    // Double rAF: commit new canvas paint + overlay before starting fade.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== fadeGen || overlayEl !== overlay) return
        overlay.style.opacity = '0'
        fadeTimer = window.setTimeout(() => {
          if (overlayEl === overlay) removeOverlay()
          fadeTimer = null
        }, opts.crossfadeMs + 40)
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
    playSnapshotCrossfade,
    resetTransform,
    resetOpacity,
    playSlideLeft,
  }
}
