// Simple SPA route watcher: fires one event when href changes.
export const ROUTE_EVENT_NAME = "dslh:route-change"

let lastHref = location.href

function emitIfChanged() {
  const href = location.href
  if (href === lastHref) return
  lastHref = href
  document.dispatchEvent(
    new CustomEvent(ROUTE_EVENT_NAME, {
      detail: { href, path: location.pathname }
    })
  )
}

export function installRouteListener() {
  // Monkey-patch history
  const origPush = history.pushState
  const origReplace = history.replaceState

  history.pushState = function (...args) {
    const ret = origPush.apply(this, args as any)
    // microtask → lets any sync DOM swaps happen first
    queueMicrotask(emitIfChanged)
    return ret
  } as typeof history.pushState

  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args as any)
    queueMicrotask(emitIfChanged)
    return ret
  } as typeof history.replaceState

  // Back/forward + hash
  const onPop = () => emitIfChanged()
  const onHash = () => emitIfChanged()
  window.addEventListener("popstate", onPop)
  window.addEventListener("hashchange", onHash)

  // Fallback polling (some frameworks mutate href “silently”)
  const iv = window.setInterval(emitIfChanged, 500)

  // Cleanup
  return () => {
    history.pushState = origPush
    history.replaceState = origReplace
    window.removeEventListener("popstate", onPop)
    window.removeEventListener("hashchange", onHash)
    clearInterval(iv)
  }
}
