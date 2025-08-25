// Wait until a subtree has been quiet (no childList changes) for a short period.
// This smooths over SSR→CSR hydration swaps on routes like /new-pairs?... .
export async function waitForStableDOM(
  root: Element,
  opts: { quietMs?: number; timeoutMs?: number } = {}
): Promise<void> {
  const quietMs = opts.quietMs ?? 200
  const timeoutMs = opts.timeoutMs ?? 5000

  return new Promise((resolve) => {
    let last = performance.now()
    let done = false

    const cleanup = (mo: MutationObserver, to: number) => {
      if (done) return
      done = true
      mo.disconnect()
      clearTimeout(to)
      resolve()
    }

    const mo = new MutationObserver(() => {
      last = performance.now()
    })
    mo.observe(root, { childList: true, subtree: true })

    const to = window.setTimeout(() => cleanup(mo, to), timeoutMs)

    const tick = () => {
      if (done) return
      if (performance.now() - last >= quietMs) return cleanup(mo, to)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}
