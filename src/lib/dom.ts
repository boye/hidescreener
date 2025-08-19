// DOM helpers en heuristieken om pair-rows te vinden

export function isDexscreener(): boolean {
  return /(^|\.)dexscreener\.com$/i.test(location.hostname)
}

export function findFeedContainer(): HTMLElement | null {
  // Dexscreener livefeed container
  return (
    document.querySelector<HTMLElement>("div.ds-dex-table") || document.body
  )
}

export function getPairIdFromNode(node: Element): string | null {
  if (!(node instanceof HTMLAnchorElement)) return null

  try {
    const url = new URL(node.href, location.origin)
    const segs = url.pathname.split("/").filter(Boolean)
    const last = segs[segs.length - 1] // → "0x4291f7..."
    return last?.toLowerCase() ?? null
  } catch {
    // fallback for edge-cases
    const href = node.getAttribute("href") || ""
    const clean = href.split("#")[0].split("?")[0]
    const parts = clean.split("/").filter(Boolean)
    return parts[parts.length - 1]?.toLowerCase() ?? null
  }
}

export function isPairRow(el: Element): el is HTMLElement {
  return el instanceof HTMLAnchorElement && el.matches("a.ds-dex-table-row")
}

export function markHidden(row: HTMLElement) {
  row.classList.add("dslh-hidden")
}
