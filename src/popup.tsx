import React from "react"

import { getSettings, updateSettings } from "~/lib/settings"
import { clearAllHidden, getHiddenList } from "~/lib/storage"

import "~/styles/popup.css" // <-- import the stylesheet

export default function Popup() {
  // State
  const [count, setCount] = React.useState(0)

  const [enabled, setEnabled] = React.useState(false)
  const [delay, setDelay] = React.useState(350)
  const [dismiss, setDismiss] = React.useState(300)
  const [w, setW] = React.useState(420)
  const [h, setH] = React.useState(280)

  // Load data
  const refreshHidden = async () => setCount((await getHiddenList()).length)
  const refreshSettings = async () => {
    const s = await getSettings()
    setEnabled(s.previewEnabled)
    setDelay(s.previewDelayMs)
    setDismiss(s.previewDismissMs)
    setW(s.previewWidth)
    setH(s.previewHeight)
  }

  React.useEffect(() => {
    refreshHidden()
    refreshSettings()
  }, [])

  // Persist changes
  const apply = async (
    patch: Partial<Awaited<ReturnType<typeof getSettings>>>
  ) => {
    await updateSettings(patch)
    await refreshSettings()
  }

  return (
    <div className="popup">
      <h3 className="h1">Hidescreener</h3>

      <div className="row" style={{ marginTop: 8 }}>
        <span>Hidden pairs</span>
        <span className="chip">{count}</span>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn btn-danger"
          onClick={async () => {
            await clearAllHidden()
            await refreshHidden()
          }}>
          Clear all hidden
        </button>
      </div>

      <div className="divider" />

      <div className="section-title">Chart preview</div>

      <label className="switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={async (e) => apply({ previewEnabled: e.target.checked })}
        />
        <span>Enable on hover over eye icon</span>
      </label>

      <div className="grid-2">
        <label>
          Delay (ms)
          <input
            type="number"
            min={0}
            value={delay}
            onChange={(e) => setDelay(parseInt(e.target.value || "0", 10))}
            onBlur={() => apply({ previewDelayMs: Math.max(0, delay | 0) })}
          />
        </label>
        <label>
          Dismiss (ms)
          <input
            type="number"
            min={0}
            value={dismiss}
            onChange={(e) => setDismiss(parseInt(e.target.value || "0", 10))}
            onBlur={() => apply({ previewDismissMs: Math.max(0, dismiss | 0) })}
          />
        </label>
        <label>
          Width
          <input
            type="number"
            min={200}
            value={w}
            onChange={(e) => setW(parseInt(e.target.value || "0", 10))}
            onBlur={() => apply({ previewWidth: Math.max(200, w | 0) })}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min={160}
            value={h}
            onChange={(e) => setH(parseInt(e.target.value || "0", 10))}
            onBlur={() => apply({ previewHeight: Math.max(160, h | 0) })}
          />
        </label>
      </div>

      <p className="small">
        The preview uses Dexscreener&apos;s embed URL and shows only the chart.
        You can adjust the delay and size here.
      </p>
    </div>
  )
}
