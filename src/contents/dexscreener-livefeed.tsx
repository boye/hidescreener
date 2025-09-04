import { clsx } from "clsx"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import {
  findFeedContainer,
  findScrollableAncestor,
  getChainFromNode,
  getPairFromNode,
  getPairIdFromNode,
  isDexscreener,
  isPairRow
} from "~/lib/dom"
import { addHiddenId, removeHiddenId, setHiddenIds } from "~/lib/hide-css"
import {
  ensureEyeOverlay,
  removeEyeOverlay,
  scheduleRepositionBurst,
  setScrollContainer
} from "~/lib/overlay"
import {
  attachHoverPreview,
  hidePreviewNow,
  setPreviewScrollContainer
} from "~/lib/preview"
import { installRouteListener, ROUTE_EVENT_NAME } from "~/lib/route"
import {
  getCachedHidden,
  safeClearAll,
  safeGetHiddenList,
  safeGetHiddenSet,
  safeHidePair,
  safeUnhidePair
} from "~/lib/safe-storage"

import "~/styles/content.css"

import { getSettings } from "~lib/settings"
import { waitForStableDOM } from "~lib/stability"
import type { HiddenEntry } from "~types"

export const config: PlasmoCSConfig = {
  matches: ["https://dexscreener.com/*"],
  run_at: "document_end",
  all_frames: false
}

async function processRow(row: HTMLAnchorElement, hidden: Set<string>) {
  const id = getPairIdFromNode(row)
  const symbols = getPairFromNode(row)
  const chain = getChainFromNode(row)

  if (!id) return
  if (hidden.has(id)) {
    // Row disappears via CSS; remove overlay
    removeEyeOverlay(row)
    return
  }
  ensureEyeOverlay(
    row,
    async () => {
      await safeHidePair(id, row.href, symbols, chain)
      addHiddenId(id)
      removeEyeOverlay(row)
      hidePreviewNow()
      document.dispatchEvent(new CustomEvent("dslh:refresh"))
      scheduleRepositionBurst(300)
    }, // onReady: wire hover preview
    (btn) => {
      attachHoverPreview(btn, () => {
        const a = (
          row instanceof HTMLAnchorElement
            ? row
            : // @ts-ignore
              row.querySelector("a.ds-dex-table-row")
        ) as HTMLAnchorElement | null
        return a?.href || null
      })
    }
  )
}

function scanAndEnhance(container: HTMLElement, hidden: Set<string>) {
  container
    .querySelectorAll<HTMLAnchorElement>("a.ds-dex-table-row")
    .forEach((row) => {
      processRow(row as unknown as HTMLAnchorElement, hidden)
    })
  scheduleRepositionBurst(300)
}

function Panel() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<HiddenEntry[]>([])
  const [count, setCount] = useState(0)

  const refresh = async () => {
    const list = await safeGetHiddenList()
    setItems(list.sort((a, b) => b.ts - a.ts))
    setCount(list.length)
  }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    document.addEventListener("dslh:refresh" as any, handler)
    return () => document.removeEventListener("dslh:refresh" as any, handler)
  }, [])

  return (
    <div className="dslh-panel">
      <div
        className="dslh-chip"
        role="button"
        onClick={() => {
          setOpen((v) => !v)
          hidePreviewNow() // hide preview on toggle
        }}>
        Hidden: {count}
      </div>
      {open && (
        <div className="dslh-list" role="dialog" aria-label="Hidden pairs">
          {items.length === 0 && (
            <div className="dslh-row">No hidden pairs.</div>
          )}
          {items.map((e) => (
            <div className="dslh-row" key={e.id}>
              <button
                className={clsx("dslh-btn dslh-ghost")}
                onClick={async () => {
                  await safeUnhidePair(e.id)
                  hidePreviewNow()
                  removeHiddenId(e.id) // triggers css-change event
                  document.dispatchEvent(new CustomEvent("dslh:refresh"))
                }}>
                Unhide
              </button>
              <a href={e.url} target="_blank" rel="noreferrer">
                <img
                  alt=""
                  width={16}
                  src={`https://dd.dexscreener.com/ds-data/chains/${e.chain}.png`}
                  loading="lazy"
                />{" "}
                {e.symbols} - {e.id}
              </a>
            </div>
          ))}
          {items.length > 0 && (
            <div
              className="dslh-row"
              style={{ justifyContent: "space-between" }}>
              <button
                className="dslh-btn dslh-danger"
                onClick={async () => {
                  await safeClearAll()
                  setHiddenIds(new Set())
                  document.dispatchEvent(new CustomEvent("dslh:refresh"))
                }}>
                Clear all
              </button>
              <button
                className="dslh-btn dslh-ghost"
                onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function mountPanel() {
  const hostId = "dslh-root"
  if (document.getElementById(hostId)) return
  const host = document.createElement("div")
  host.id = hostId
  document.documentElement.appendChild(host)
  createRoot(host).render(<Panel />)
}

export default function ContentScript() {
  useEffect(() => {
    if (!isDexscreener()) return
    mountPanel()

    let detachRoute: (() => void) | null = null
    let detachContainer: (() => void) | null = null
    let refreshTimer: number | null = null

    const startRefreshTicker = async () => {
      // (re)start based on settings.refreshIntervalSec
      if (refreshTimer != null) {
        clearInterval(refreshTimer)
        refreshTimer = null
      }
      try {
        const s = await getSettings()
        const sec = Math.max(0, s.refreshIntervalSec | 0)
        // console.log("DSLH: refresh interval", sec, "sec")
        if (sec > 0) {
          refreshTimer = window.setInterval(() => {
            // A short burst is fine – it recalculates visibility + occlusion.
            // console.log("DSLH: periodic refresh")
            scheduleRepositionBurst(300)
          }, sec * 1000)
        }
      } catch {
        // ignore – keep timer off if settings retrieval fails
      }
    }

    // Function that mounts the container (MO, listeners) and performs initial scan
    const attachToContainer = async () => {
      // cleanup previous attach
      detachContainer?.()
      const container = findFeedContainer()

      if (!container) {
        console.log("DSLH: no feed container found")
        return
      }

      const scroller = findScrollableAncestor(container)

      if (!scroller) {
        console.log("DSLH: no scrollable ancestor found")
        return
      }

      setScrollContainer(scroller)
      setPreviewScrollContainer(scroller)

      await waitForStableDOM(container, { quietMs: 400, timeoutMs: 4000 })

      // initial hidden CSS + scan
      const hidden = await safeGetHiddenSet()
      setHiddenIds(hidden)
      scanAndEnhance(container, hidden)

      // Observer for dynamic items
      const observer = new MutationObserver(async (muts) => {
        const freshHidden = await safeGetHiddenSet()
        for (const mut of muts) {
          mut.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
              if (isPairRow(n)) {
                processRow(n as unknown as HTMLAnchorElement, freshHidden)
              } else {
                // @ts-ignore
                n.querySelectorAll("a.ds-dex-table-row").forEach((a) => {
                  processRow(a as unknown as HTMLAnchorElement, freshHidden)
                })
              }
            }
          })
        }
        scheduleRepositionBurst(400)
      })
      observer.observe(container, { childList: true, subtree: true })

      // Sort/filter triggers → short RAF burst
      const burst = () => scheduleRepositionBurst(700)
      const onClick = (e: Event) => {
        const t = e.target as Element | null
        if (!t) return
        if (t.closest("th, [role='columnheader'], [data-sort]")) burst()
        if (
          t.closest(
            ".ds-advanced-filter, .ds-filter, .ds-filter-panel, [data-role='filter']"
          )
        )
          burst()
        burst()
      }
      container.addEventListener("click", onClick, true)
      container.addEventListener("change", burst, true)
      container.addEventListener("input", burst, true)
      container.addEventListener("transitionend", burst, true)

      // ResizeObserver → layout changes
      const ro = new ResizeObserver(() => burst())
      ro.observe(container)

      // Listen for CSS-hiding updates (add/remove/set) so unhide immediately restores overlay
      const onCssChange = async (e: any) => {
        scheduleRepositionBurst(400)
        const detail = e?.detail as { action?: string; id?: string } | undefined
        const freshHidden = getCachedHidden()

        if (detail?.action === "remove" && detail.id) {
          const sel =
            `.ds-dex-table a.ds-dex-table-row[href$='/${detail.id}'], ` +
            `.ds-dex-table a.ds-dex-table-row[href*='/${detail.id}?'], ` +
            `.ds-dex-table a.ds-dex-table-row[href*='/${detail.id}#']`
          container.querySelectorAll<HTMLAnchorElement>(sel).forEach((row) => {
            processRow(row as unknown as HTMLAnchorElement, freshHidden)
          })
        } else {
          scanAndEnhance(container, freshHidden)
        }
      }
      document.addEventListener("dslh:css-change", onCssChange as any)

      // Detacher for this container
      detachContainer = () => {
        observer.disconnect()
        ro.disconnect()
        container.removeEventListener("click", onClick, true)
        container.removeEventListener("change", burst, true)
        container.removeEventListener("input", burst, true)
        container.removeEventListener("transitionend", burst, true)
        document.removeEventListener("dslh:css-change", onCssChange as any)
      }

      await startRefreshTicker()
    }

    // Debounced hard reattach (2× RAF to let the SPA paint)
    const hardReattach = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => attachToContainer())
      )
    }

    // 🔽 NEW: light refresh for querystring-only changes
    const lightRefresh = () => {
      const container = findFeedContainer() || document.body
      const hidden = getCachedHidden() // no storage call
      scanAndEnhance(container, hidden)
      scheduleRepositionBurst(400)
    }

    // First mount
    // console.log("DSLH: initializing")
    hardReattach()

    // Init + route watcher
    const onRoute = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { kind: "path" | "search" | "hash"; [k: string]: any }
        | undefined

      if (!detail) {
        hardReattach()
        return
      }

      if (detail.kind === "path") {
        // console.log("DSLH: route change detected → reattaching")
        // full view change → tear down and reattach
        setTimeout(hardReattach, 1000)
      } else if (detail.kind === "search") {
        // console.log("DSLH: query change detected → light refresh")
        // filters / sorting reflected in ?query → light refresh only
        lightRefresh()
      } else {
        // console.log("DSLH: hash change detected → reposition")
        // hash-only → minor layout shifts; just reposition
        scheduleRepositionBurst(250)
      }

      startRefreshTicker()
    }

    detachRoute = installRouteListener()
    document.addEventListener(ROUTE_EVENT_NAME, onRoute)

    return () => {
      document.removeEventListener(ROUTE_EVENT_NAME, onRoute)
      detachContainer?.()
      detachRoute?.()
    }
  }, [])

  return null
}
