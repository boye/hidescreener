// CSS-based hiding zonder DOM-mutaties in de React-subtree
// Voor Dexscreener: row is <a class="ds-dex-table-row">. We targetten die direct.

const STYLE_ID = "dslh-hide-style"
const present = new Set<string>() // -> huidige set van verborgen IDs

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

// Bouw 1 compacte selector die varianten vangt: einde van URL, ?query, #hash
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
  // Eén write; geen CSSOM indexgedoe
  el.textContent = Array.from(present, ruleFor).join("\n")
}

// Kleiner hulpfunctie: fire een event NA aanpassing (microtask)
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
