import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import { clearAllHidden, getHiddenList, unhidePair } from "~/lib/storage"

async function Options() {
  const [items, setItems] = useState(await getHiddenList())
  const refresh = async () => setItems(await getHiddenList())

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: 16
      }}>
      <h1>Dexscreener Hidelist</h1>
      <p>Manage hidden pairs.</p>
      <div style={{ display: "grid", gap: 8 }}>
        {items.length === 0 && <div>No hidden pairs.</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {items.length === 0 && <div>Geen verborgen items.</div>}
          {items.map((it) => (
            <div
              key={it.id}
              style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code>{it.id}</code>
              <a
                href={`https://dexscreener.com/ethereum/${it.id}`}
                target="_blank"
                rel="noreferrer">
                Open
              </a>
              <button
                onClick={async () => {
                  await unhidePair(it.id)
                  await refresh()
                }}>
                Unhide
              </button>
            </div>
          ))}
        </div>
      </div>
      {items.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={async () => {
              await clearAllHidden()
              await refresh()
            }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

const root = document.querySelector("#root")!
// @ts-ignore
createRoot(root).render(<Options />)
