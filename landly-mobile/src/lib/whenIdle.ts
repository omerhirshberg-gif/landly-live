// Runs `run` once the JS thread is idle (requestIdleCallback where the
// runtime has it, as React Native's does), and at the latest after
// `timeoutMs`; a plain timeout elsewhere. Returns the cancel.
const IDLE_TIMEOUT_MS = 500

type IdleGlobal = {
  requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

export function whenIdle(run: () => void, timeoutMs = IDLE_TIMEOUT_MS): () => void {
  const idle = globalThis as IdleGlobal
  if (idle.requestIdleCallback) {
    const id = idle.requestIdleCallback(run, { timeout: timeoutMs })
    return () => idle.cancelIdleCallback?.(id)
  }
  const id = setTimeout(run, 0)
  return () => clearTimeout(id)
}
