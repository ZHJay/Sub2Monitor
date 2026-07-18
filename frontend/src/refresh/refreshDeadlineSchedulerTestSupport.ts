import type {
  RefreshSchedulerEnvironment,
  RefreshSchedulerEventPort,
  RefreshSchedulerPagePort,
} from './refreshDeadlineScheduler'

export class FakeEventPort extends EventTarget implements RefreshSchedulerEventPort {
  emit(type: string) { this.dispatchEvent(new Event(type)) }
}

class FakePagePort extends FakeEventPort implements RefreshSchedulerPagePort {
  visibilityState: DocumentVisibilityState = 'visible'

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state
    this.emit('visibilitychange')
  }
}

export class FakeRefreshEnvironment implements RefreshSchedulerEnvironment {
  readonly page = new FakePagePort()
  readonly runtime = new FakeEventPort()
  private nowMs = 0
  private nextTimerId = 1
  private timers = new Map<number, { dueMs: number; callback: () => void }>()

  now = () => this.nowMs
  setTimer = (callback: () => void, delayMs: number) => {
    const id = this.nextTimerId++
    this.timers.set(id, { dueMs: this.nowMs + delayMs, callback })
    return id
  }
  clearTimer = (id: number) => { this.timers.delete(id) }

  advance(ms: number, runTimers = true) {
    this.nowMs += ms
    if (!runTimers) return
    const due = [...this.timers.entries()]
      .filter(([, timer]) => timer.dueMs <= this.nowMs)
      .sort((left, right) => left[1].dueMs - right[1].dueMs)
    for (const [id, timer] of due) {
      this.timers.delete(id)
      timer.callback()
    }
  }
}

export async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
