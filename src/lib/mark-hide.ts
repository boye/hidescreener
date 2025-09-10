// DOM-marking based hiding (for large hidden lists)
// We avoid per-ID CSS selectors; instead we add/remove a single class per row.

const MARK_STYLE_ID = "dslh-mark-css"

export function ensureMarkCss() {
  if (document.getElementById(MARK_STYLE_ID)) return
  const s = document.createElement("style")
  s.id = MARK_STYLE_ID
  s.textContent = `.dslh-hidden { display: none !important; }`
  document.head.appendChild(s)
}

// Toggle class on a specific row container
export function setRowHidden(rowEl: HTMLElement, hidden: boolean) {
  rowEl.classList.toggle("dslh-hidden", hidden)
}

// Remove class for all rows matching a specific pair id under a container
export function unmarkById(container: HTMLElement, id: string) {
  const sel = `a[href$='/${id}'], a[href*='/${id}?'], a[href*='/${id}#']`
  container.querySelectorAll<HTMLAnchorElement>(sel).forEach((a) => {
    a.classList.remove("dslh-hidden")
  })
}

// Apply marks across the current container based on a hidden set
export function applyMarksInContainer(
  container: HTMLElement,
  hidden: Set<string>
) {
  const anchors = container.querySelectorAll<HTMLAnchorElement>("a[href]")
  anchors.forEach((a) => {
    // Extract id from URL path end; avoid re-parsing if not needed
    try {
      const u = new URL(a.href, location.origin)
      const segs = u.pathname.split("/").filter(Boolean)
      const id = segs[segs.length - 1]?.toLowerCase()
      if (!id) return
      setRowHidden(a, hidden.has(id))
    } catch {
      // ignore malformed hrefs
    }
  })
}
