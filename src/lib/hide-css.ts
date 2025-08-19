// CSS-based hiding without DOM mutations in the React subtree
// For Dexscreener: row is <a class="ds-dex-table-row">. We target those directly.

const STYLE_ID = "dslh-hide-style"
const present = new Set<string>() // -> current set of hidden IDs

function ensureStyleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement("style")
    el.id = STYLE_ID
    el.appendChild(document.createTextNode(""))
    document.head.appendChild(el)
  }
  return el
}

function escapeForAttr(v: string) {
  return v.replace(/["\\]/g, "\\$&")
}

// Build one compact selector that catches variants: end of URL, ?query, #hash
function ruleFor(id: string) {
  const v = escapeForAttr(id)
  return (
    [
      `.ds-dex-table a.ds-dex-table-row[href$='/${v}']`,
      `.ds-dex-table a.ds-dex-table-row[href*='/${v}?']`,
      `.ds-dex-table a.ds-dex-table-row[href*='/${v}#']`
    ].join(", ") + " { display: none !important; }"
  )
}

function rebuildSheet() {
  const el = ensureStyleEl()
  // One write; no CSSOM index hassle
  el.textContent = Array.from(present, ruleFor).join("\n")
}

// Small helper function: fire an event AFTER modification (microtask)
function emitCssChange(action: "set" | "add" | "remove", id?: string) {
  queueMicrotask(() =>
    document.dispatchEvent(
      new CustomEvent("dslh:css-change", { detail: { action, id } })
    )
  )
}

export function setHiddenIds(ids: Set<string>) {
  present.clear()
  ids.forEach((id) => present.add(id))
  rebuildSheet()
  emitCssChange("set")
}

export function addHiddenId(id: string) {
  if (present.has(id)) return
  present.add(id)
  rebuildSheet()
  emitCssChange("add", id)
}

export function removeHiddenId(id: string) {
  if (!present.delete(id)) return
  rebuildSheet()
  emitCssChange("remove", id)
}
