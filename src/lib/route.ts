// SPA route watcher that differentiates path vs search vs hash changes.
// Emits a single "dslh:route-change" event with a rich detail payload.

export const ROUTE_EVENT_NAME = "dslh:route-change"

type Kind = "path" | "search" | "hash"

let lastHref = location.href

function emitIfChanged() {
  const prevUrl = new URL(lastHref, location.origin)
  const nextUrl = new URL(location.href, location.origin)

  if (nextUrl.href === lastHref) return

  let kind: Kind = "path"
  if (nextUrl.pathname !== prevUrl.pathname) kind = "path"
  else if (nextUrl.search !== prevUrl.search) kind = "search"
  else kind = "hash"

  lastHref = nextUrl.href

  document.dispatchEvent(
    new CustomEvent(ROUTE_EVENT_NAME, {
      detail: {
        kind,
        href: nextUrl.href,
        prevHref: prevUrl.href,
        path: nextUrl.pathname,
        prevPath: prevUrl.pathname,
        search: nextUrl.search,
        prevSearch: prevUrl.search,
        hash: nextUrl.hash,
        prevHash: prevUrl.hash
      }
    })
  )
}

export function installRouteListener() {
  const origPush = history.pushState
  const origReplace = history.replaceState

  history.pushState = function (...args) {
    const ret = origPush.apply(this, args as any)
    queueMicrotask(emitIfChanged) // after state change
    return ret
  } as typeof history.pushState

  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args as any)
    queueMicrotask(emitIfChanged)
    return ret
  } as typeof history.replaceState

  const onPop = () => emitIfChanged()
  const onHash = () => emitIfChanged()
  window.addEventListener("popstate", onPop)
  window.addEventListener("hashchange", onHash)

  // Fallback polling in case the app mutates window.location silently
  const iv = window.setInterval(emitIfChanged, 500)

  return () => {
    history.pushState = origPush
    history.replaceState = origReplace
    window.removeEventListener("popstate", onPop)
    window.removeEventListener("hashchange", onHash)
    clearInterval(iv)
  }
}
