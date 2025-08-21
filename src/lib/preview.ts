// Hover chart preview overlay (optional; enabled via popup settings).
// Shows a fixed-position panel with an <iframe> to Dexscreener's embed URL.
// - Panel is interactable (pointer-events: auto).
// - Uses hover-intent to show (delay) and grace delay to hide.
// - Hides on route change, window resize, or internal scroll.

import type { Settings } from "./settings"
import { getSettings } from "./settings"
import { buildEmbedUrl } from "./url"

let root: HTMLDivElement | null = null
let panel: HTMLDivElement | null = null
let iframe: HTMLIFrameElement | null = null

// Show-delay timers are per-button (multiple buttons may be hovered rapidly)
const showTimerByBtn = new WeakMap<HTMLElement, number>()
// Hide timer is global (single panel)
let hideTimer: number | null = null

let lastSettings: Settings | null = null
let scroller: HTMLElement | null = null

function getRoot() {
  if (!root) {
    root = document.createElement("div")
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none", // container ignores pointer events
      zIndex: "2147483647"
    } as CSSStyleDeclaration)
    root.id = "dslh-preview-root"
    document.documentElement.appendChild(root)
  }
  return root
}

function ensurePanel(settings: Settings) {
  lastSettings = settings
  const host = getRoot()
  if (!panel) {
    panel = document.createElement("div")
    panel.id = "dslh-chart-preview"
    Object.assign(panel.style, {
      position: "fixed",
      width: settings.previewWidth + "px",
      height: settings.previewHeight + "px",
      borderRadius: "10px",
      overflow: "hidden",
      boxShadow: "0 8px 28px rgba(0,0,0,.35)",
      background: "#0b0b0b",
      pointerEvents: "auto", // <-- interactable panel
      display: "none"
    } as CSSStyleDeclaration)

    iframe = document.createElement("iframe")
    Object.assign(iframe.style, {
      width: "100%",
      height: "100%",
      border: "0"
    } as CSSStyleDeclaration)
    iframe.setAttribute("referrerpolicy", "no-referrer")
    iframe.loading = "lazy"

    panel.appendChild(iframe)
    host.appendChild(panel)

    // Keep-open behaviour: cancel hide while hovering the panel; hide after leaving with grace delay
    panel.addEventListener("mouseenter", cancelHide)
    panel.addEventListener("mouseleave", () => scheduleHide())
  } else {
    panel.style.width = settings.previewWidth + "px"
    panel.style.height = settings.previewHeight + "px"
  }
}

function positionNear(btnRect: DOMRect, settings: Settings) {
  if (!panel) return
  const gap = 10
  const panelW = settings.previewWidth
  const panelH = settings.previewHeight
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  // default to the right of the button
  let x = btnRect.right + gap
  let y = Math.round(btnRect.top + (btnRect.height - panelH) / 2)

  // clamp within viewport
  if (x + panelW > viewportW) x = Math.max(8, btnRect.left - gap - panelW)
  if (y + panelH > viewportH) y = viewportH - panelH - 8
  if (y < 8) y = 8

  panel.style.left = `${x}px`
  panel.style.top = `${y}px`
}

export function hidePreviewNow() {
  if (hideTimer != null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (panel) panel.style.display = "none"
  if (iframe) iframe.src = "about:blank"
}

function cancelHide() {
  if (hideTimer != null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function scheduleHide(delayMs?: number) {
  cancelHide()
  const ms = delayMs ?? lastSettings?.previewDismissMs ?? 300
  hideTimer = window.setTimeout(() => {
    hidePreviewNow()
  }, ms)
}

export function setPreviewScrollContainer(el: HTMLElement | null) {
  scroller = el
  if (!scroller) return
  const onScroll = () => hidePreviewNow() // scrolling the list closes the preview immediately
  scroller.addEventListener("scroll", onScroll, { passive: true })
}

export function attachHoverPreview(
  btn: HTMLElement,
  getHref: () => string | null
) {
  const onEnter = async () => {
    const settings = await getSettings()
    if (!settings.previewEnabled) return

    ensurePanel(settings)
    cancelHide() // if panel was about to hide, keep it during new hover

    // schedule show after hover-intent delay
    const t = window.setTimeout(() => {
      const href = getHref()
      if (!href || !panel || !iframe) return
      try {
        const url = new URL(href, location.origin)
        const segs = url.pathname.split("/").filter(Boolean)
        if (segs.length < 2) return
        const chain = segs[0].toLowerCase()
        const id = segs[1].toLowerCase()
        iframe.src = buildEmbedUrl(chain, id)

        const r = btn.getBoundingClientRect()
        positionNear(r, settings)
        panel.style.display = ""
      } catch {
        // ignore malformed hrefs
      }
    }, settings.previewDelayMs)

    showTimerByBtn.set(btn, t)
  }

  const onLeave = async () => {
    const settings = await getSettings()
    // cancel pending show for this button
    const t = showTimerByBtn.get(btn)
    if (t) clearTimeout(t)
    // schedule hide with grace delay (so the user can move into the panel)
    if (settings.previewEnabled) scheduleHide(settings.previewDismissMs)
  }

  btn.addEventListener("mouseenter", onEnter)
  btn.addEventListener("mouseleave", onLeave)

  // Hard hides on viewport/route changes
  window.addEventListener("resize", hidePreviewNow)
  document.addEventListener("dslh:route-change" as any, hidePreviewNow as any)
}
