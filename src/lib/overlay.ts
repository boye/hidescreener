// src/lib/overlay.ts
let overlayRoot: HTMLDivElement | null = null
const btnByRow = new Map<HTMLElement, HTMLButtonElement>() // iterable

// Internal scroller (link via setScrollContainer in content script)
let scrollEl: HTMLElement | null = null
let scrollDetachers: Array<() => void> = []

let burstUntil = 0
let rafId: number | null = null

function getOverlayRoot() {
  if (!overlayRoot) {
    overlayRoot = document.createElement("div")
    Object.assign(overlayRoot.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483647"
    } as CSSStyleDeclaration)
    overlayRoot.id = "dslh-overlay-root"
    document.documentElement.appendChild(overlayRoot)
  }
  return overlayRoot
}

function viewportRect(): DOMRect {
  return scrollEl
    ? scrollEl.getBoundingClientRect()
    : new DOMRect(0, 0, window.innerWidth, window.innerHeight)
}

function firstNonOverlayAt(x: number, y: number): HTMLElement | null {
  const stack = document.elementsFromPoint(x, y) as HTMLElement[]
  for (const el of stack) {
    if (!el) continue
    if (el.id === "dslh-overlay-root") continue
    if (el.classList?.contains("dslh-overlay-btn")) continue
    if (el.closest?.("#dslh-overlay-root")) continue
    return el
  }
  return null
}

function isVisible(row: HTMLElement) {
  if (!row.isConnected) return false

  const style = getComputedStyle(row)
  if (style.display === "none" || style.visibility === "hidden") return false

  const r = row.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false

  const v = viewportRect()

  // Test point = place where the icon appears
  const x = Math.max(0, r.left) + 10
  const y = r.top + r.height / 2

  // Must fall within the scroller viewport
  if (x < v.left || x > v.right || y < v.top || y > v.bottom) return false

  // Occlusion check: if something else is on top (sticky header, etc.), hide icon
  const topHit = firstNonOverlayAt(x, y)
  if (!topHit) return false
  return topHit.closest?.("a.ds-dex-table-row") === row
}

function positionBtn(row: HTMLElement, btn: HTMLButtonElement) {
  const r = row.getBoundingClientRect()
  const x = Math.max(0, r.left) + 6
  const y = r.top + (r.height - 18) / 2
  btn.style.position = "fixed"
  btn.style.left = `${x}px`
  btn.style.top = `${y}px`
}

export function ensureEyeOverlay(
  row: HTMLElement,
  onClick: () => void,
  onReady?: (btn: HTMLButtonElement) => void
) {
  const existing = btnByRow.get(row)
  if (existing) {
    onReady?.(existing)
    return
  }
  const root = getOverlayRoot()
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "dslh-eye-btn dslh-overlay-btn"
  btn.title = "Hide this pair"
  btn.setAttribute("aria-label", "Hide this pair")
  btn.style.pointerEvents = "auto"
  // eye-off icon
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
    <path fill="currentColor" d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/>
    <path d="M4 4L20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  root.appendChild(btn)
  btnByRow.set(row, btn)

  if (isVisible(row)) {
    btn.style.display = ""
    positionBtn(row, btn)
  } else {
    btn.style.display = "none"
  }

  onReady?.(btn)
}

export function removeEyeOverlay(row: HTMLElement) {
  const btn = btnByRow.get(row)
  if (btn) btn.remove()
  btnByRow.delete(row)
}

export function repositionAll(prune = true) {
  for (const [row, btn] of btnByRow.entries()) {
    if (!isVisible(row)) {
      btn.style.display = "none"
      if (prune && !row.isConnected) {
        btn.remove()
        btnByRow.delete(row)
      }
      continue
    }
    btn.style.display = ""
    positionBtn(row, btn)
  }
}

function rafLoop() {
  rafId = null
  repositionAll(true)
  if (performance.now() < burstUntil) {
    rafId = requestAnimationFrame(rafLoop)
  }
}

export function scheduleRepositionBurst(ms = 600) {
  burstUntil = Math.max(burstUntil, performance.now() + ms)
  if (rafId == null) {
    rafId = requestAnimationFrame(rafLoop)
  }
}

// Link the internal scroller (call this after mount/route change)
export function setScrollContainer(el: HTMLElement | null) {
  // detach old listeners
  for (const off of scrollDetachers)
    try {
      off()
    } catch {}
  scrollDetachers = []
  scrollEl = el

  if (scrollEl) {
    const onScroll = () => scheduleRepositionBurst(120)
    scrollEl.addEventListener("scroll", onScroll, { passive: true })
    scrollDetachers.push(() =>
      scrollEl?.removeEventListener("scroll", onScroll as any)
    )

    const ro = new ResizeObserver(() => scheduleRepositionBurst(200))
    ro.observe(scrollEl)
    scrollDetachers.push(() => ro.disconnect())
  }
}

// Fallback for viewport changes
window.addEventListener("scroll", () => scheduleRepositionBurst(200), {
  passive: true
})
window.addEventListener("resize", () => scheduleRepositionBurst(400))
