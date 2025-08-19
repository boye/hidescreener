import { clsx } from "clsx"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import {
  findFeedContainer,
  getPairIdFromNode,
  isDexscreener,
  isPairRow
} from "~/lib/dom"
import { addHiddenId, removeHiddenId, setHiddenIds } from "~/lib/hide-css"
import {
  ensureEyeOverlay,
  removeEyeOverlay,
  scheduleRepositionBurst
} from "~/lib/overlay"
import { installRouteListener, ROUTE_EVENT_NAME } from "~/lib/route"
import {
  clearAllHidden,
  getHiddenList,
  getHiddenSet,
  hidePair,
  unhidePair
} from "~/lib/storage"

import "~/styles/content.css"

export const config: PlasmoCSConfig = {
  matches: ["https://dexscreener.com/*"],
  run_at: "document_end",
  all_frames: false
}

async function processRow(row: HTMLElement, hidden: Set<string>) {
  const id = getPairIdFromNode(row)
  if (!id) return
  if (hidden.has(id)) {
    // Row verdwijnt via CSS; overlay verwijderen
    removeEyeOverlay(row)
    return
  }
  ensureEyeOverlay(row, async () => {
    await hidePair(id)
    addHiddenId(id)
    removeEyeOverlay(row)
    document.dispatchEvent(new CustomEvent("dslh:refresh"))
    scheduleRepositionBurst(300)
  })
}

function scanAndEnhance(container: HTMLElement, hidden: Set<string>) {
  container
    .querySelectorAll<HTMLAnchorElement>("a.ds-dex-table-row")
    .forEach((row) => {
      processRow(row as unknown as HTMLElement, hidden)
    })
  scheduleRepositionBurst(300)
}

// Paneel UI (ongewijzigd)
function Panel() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<{ id: string; ts: number }[]>([])
  const [count, setCount] = useState(0)

  const refresh = async () => {
    const list = await getHiddenList()
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
        onClick={() => setOpen((v) => !v)}>
        Hidden: {count}
      </div>
      {open && (
        <div className="dslh-list" role="dialog" aria-label="Hidden pairs">
          {items.length === 0 && (
            <div className="dslh-row">Geen verborgen pairs.</div>
          )}
          {items.map((e) => (
            <div className="dslh-row" key={e.id}>
              <button
                className={clsx("dslh-btn dslh-ghost")}
                onClick={async () => {
                  await unhidePair(e.id)
                  removeHiddenId(e.id) // triggert css-change event
                  document.dispatchEvent(new CustomEvent("dslh:refresh"))
                }}>
                Unhide
              </button>
              <a
                href={`https://dexscreener.com/ethereum/${e.id}`}
                target="_blank"
                rel="noreferrer">
                {e.id}
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
                  await clearAllHidden()
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

    // Functie die de container mount (MO, listeners) en initial scan uitvoert
    const attachToContainer = async () => {
      // cleanup vorige attach
      detachContainer?.()
      const container = findFeedContainer() || document.body

      // initial hidden CSS + scan
      const hidden = await getHiddenSet()
      setHiddenIds(hidden)
      scanAndEnhance(container, hidden)

      // Observer voor dynamische items
      const observer = new MutationObserver(async (muts) => {
        const freshHidden = await getHiddenSet()
        for (const mut of muts) {
          mut.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
              if (isPairRow(n)) {
                processRow(n as unknown as HTMLElement, freshHidden)
              } else {
                // @ts-ignore
                n.querySelectorAll("a.ds-dex-table-row").forEach((a) => {
                  processRow(a as unknown as HTMLElement, freshHidden)
                })
              }
            }
          })
        }
        scheduleRepositionBurst(400)
      })
      observer.observe(container, { childList: true, subtree: true })

      // Sort/filter triggers → korte RAF-burst
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

      // Luister op CSS-hiding updates (add/remove/set) zodat unhide direct overlay terugzet
      const onCssChange = async (e: any) => {
        scheduleRepositionBurst(400)
        const detail = e?.detail as { action?: string; id?: string } | undefined
        const freshHidden = await getHiddenSet()

        if (detail?.action === "remove" && detail.id) {
          const sel =
            `.ds-dex-table a.ds-dex-table-row[href$='/${detail.id}'], ` +
            `.ds-dex-table a.ds-dex-table-row[href*='/${detail.id}?'], ` +
            `.ds-dex-table a.ds-dex-table-row[href*='/${detail.id}#']`
          container.querySelectorAll<HTMLAnchorElement>(sel).forEach((row) => {
            processRow(row as unknown as HTMLElement, freshHidden)
          })
        } else {
          scanAndEnhance(container, freshHidden)
        }
      }
      document.addEventListener("dslh:css-change", onCssChange as any)

      // Detacher voor deze container
      detachContainer = () => {
        observer.disconnect()
        ro.disconnect()
        container.removeEventListener("click", onClick, true)
        container.removeEventListener("change", burst, true)
        container.removeEventListener("input", burst, true)
        container.removeEventListener("transitionend", burst, true)
        document.removeEventListener("dslh:css-change", onCssChange as any)
      }
    }

    // Init + route watcher
    const reattachSoon = () => {
      // 2 RAF's om SPA DOM-swaps ruimte te geven
      requestAnimationFrame(() =>
        requestAnimationFrame(() => attachToContainer())
      )
    }
    reattachSoon()

    detachRoute = installRouteListener()
    document.addEventListener(ROUTE_EVENT_NAME, reattachSoon)

    return () => {
      document.removeEventListener(ROUTE_EVENT_NAME, reattachSoon)
      detachContainer?.()
      detachRoute?.()
    }
  }, [])

  return null
}
