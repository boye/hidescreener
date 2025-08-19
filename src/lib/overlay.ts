let overlayRoot: HTMLDivElement | null = null
const btnByRow = new Map<HTMLElement, HTMLButtonElement>() // <-- Map i.p.v. WeakMap

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

function isVisible(el: HTMLElement) {
  if (!el.isConnected) return false
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  const style = getComputedStyle(el)
  if (style.display === "none" || style.visibility === "hidden") return false
  // optioneel extra guard: moet in de container blijven
  if (!el.closest(".ds-dex-table")) return false
  return true
}

function positionBtn(row: HTMLElement, btn: HTMLButtonElement) {
  const r = row.getBoundingClientRect()
  const x = Math.max(0, r.left) + 6
  const y = r.top + (r.height - 18) / 2
  btn.style.position = "fixed"
  btn.style.left = `${x}px`
  btn.style.top = `${y}px`
}

export function ensureEyeOverlay(row: HTMLElement, onClick: () => void) {
  if (btnByRow.has(row)) return
  const root = getOverlayRoot()
  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "dslh-eye-btn dslh-overlay-btn"
  btn.title = "Hide this pair"
  btn.setAttribute("aria-label", "Hide this pair")
  btn.style.pointerEvents = "auto"
  btn.innerHTML = `
<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
  <!-- oog -->
  <path fill="currentColor"
    d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/>
  <!-- schuine streep -->
  <path d="M4 4L20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

  btn.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  root.appendChild(btn)
  btnByRow.set(row, btn)
  if (isVisible(row)) positionBtn(row, btn)
}

export function removeEyeOverlay(row: HTMLElement) {
  const btn = btnByRow.get(row)
  if (btn) btn.remove()
  btnByRow.delete(row)
}

export function repositionAll(prune = true) {
  for (const [row, btn] of btnByRow.entries()) {
    if (!isVisible(row)) {
      if (prune) {
        btn.remove()
        btnByRow.delete(row)
      }
      continue
    }
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

// viewport changes ⇒ overlays bijwerken
window.addEventListener("scroll", () => scheduleRepositionBurst(200), {
  passive: true
})
window.addEventListener("resize", () => scheduleRepositionBurst(400))
