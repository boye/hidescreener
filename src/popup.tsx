import { useEffect, useState } from "react"

import { clearAllHidden, getHiddenList } from "~/lib/storage"

function Popup() {
  const [count, setCount] = useState(0)
  const refresh = async () => setCount((await getHiddenList()).length)
  useEffect(() => {
    refresh()
  }, [])

  return (
    <div
      style={{
        width: 280,
        padding: 12,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      }}>
      <h3 style={{ margin: 0 }}>Hidescreener</h3>
      <p style={{ marginTop: 8 }}>
        Hidden pairs: <strong>{count}</strong>
      </p>
      <button
        onClick={async () => {
          await clearAllHidden()
          await refresh()
        }}>
        Clear all hidden
      </button>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Tip: Use the floating badge in the bottom left corner to recover hidden
        pairs.
      </p>
    </div>
  )
}

export default Popup
