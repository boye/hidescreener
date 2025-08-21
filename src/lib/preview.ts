// Hover chart preview overlay (optional; enabled via popup settings).
// Interactable panel with hover-intent (show delay) and grace dismiss (hide delay).
// This version avoids "instant show" when moving between buttons by not cancelling
// a pending hide on a different target, and by soft-hiding before retargeting.

import type { Settings } from "./settings"
import { getSettings } from "./settings"
import { buildEmbedUrl } from "./url"

let root: HTMLDivElement | null = null
let panel: HTMLDivElement | null = null
let iframe: HTMLIFrameElement | null = null

// Per-button show timers
const showTimerByBtn = new WeakMap<HTMLElement, number>()
// Global hide timer
let hideTimer: number | null = null

// Track the button currently owning the preview (if any)
let currentBtn: HTMLElement | null = null
let lastSettings: Settings | null = null
let scroller: HTMLElement | null = null

function getRoot() {
  if (!root) {
    root = document.createElement("div")
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
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
      pointerEvents: "auto",
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

    // Keep-open while hovering the panel; schedule hide on leave with grace delay
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

  let x = btnRect.right + gap
  let y = Math.round(btnRect.top + (btnRect.height - panelH) / 2)

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
  currentBtn = null
  if (panel) panel.style.display = "none"
  if (iframe) iframe.src = "about:blank"
}

function softHidePreview() {
  // Hide visually but keep iframe src to avoid unnecessary reloads while retargeting quickly
  if (panel) panel.style.display = "none"
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
  const onScroll = () => hidePreviewNow() // list scroll closes the preview immediately
  scroller.addEventListener("scroll", onScroll, { passive: true })
}

export function attachHoverPreview(
  btn: HTMLElement,
  getHref: () => string | null
) {
  // Guard: wire exactly once per button
  if ((btn as any)._dslhPreviewWired) return
  ;(btn as any)._dslhPreviewWired = true

  const onEnter = async () => {
    const settings = await getSettings()
    if (!settings.previewEnabled) return

    ensurePanel(settings)

    // Clear previous show timer for this button
    const existingTimer = showTimerByBtn.get(btn)
    if (existingTimer) clearTimeout(existingTimer)

    // If we’re entering a different button than the one currently owning the panel,
    // DO NOT cancel a pending hide (we want the delay to apply). Soft-hide now to avoid "instant show".
    if (currentBtn && currentBtn !== btn) {
      softHidePreview()
      // Do NOT cancel an already scheduled hide; let grace hide run if any
    }

    // Schedule show after the configured delay
    const t = window.setTimeout(() => {
      const href = getHref()
      if (!href || !panel || !iframe) return

      try {
        const url = new URL(href, location.origin)
        const segs = url.pathname.split("/").filter(Boolean)
        if (segs.length < 2) return
        const chain = segs[0].toLowerCase()
        const id = segs[1].toLowerCase()

        const embed = buildEmbedUrl(chain, id)
        // Only update src if it changed to avoid chart state resets
        if (iframe.src !== embed) iframe.src = embed

        const r = btn.getBoundingClientRect()
        positionNear(r, settings)

        currentBtn = btn
        panel.style.display = ""
      } catch {
        // ignore malformed hrefs
      }
    }, settings.previewDelayMs)

    showTimerByBtn.set(btn, t)
  }

  const onLeave = async () => {
    const settings = await getSettings()
    // Cancel pending show for this button
    const t = showTimerByBtn.get(btn)
    if (t) clearTimeout(t)
    // Only schedule hide if this button currently owns the preview
    if (currentBtn === btn && settings.previewEnabled) {
      scheduleHide(settings.previewDismissMs)
    }
  }

  btn.addEventListener("mouseenter", onEnter)
  btn.addEventListener("mouseleave", onLeave)

  // Hard hides on viewport/route changes
  window.addEventListener("resize", hidePreviewNow)
  document.addEventListener("dslh:route-change" as any, hidePreviewNow as any)
}
