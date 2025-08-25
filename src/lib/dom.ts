// DOM helpers
export function isDexscreener(): boolean {
  return /(^|\.)dexscreener\.com$/i.test(location.hostname)
}

export function findFeedContainer(): HTMLElement | null {
  // Dexscreener livefeed container
  return document.querySelector<HTMLElement>(".ds-dex-table")
}

export function findScrollableAncestor(el: Element | null): HTMLElement | null {
  let cur = el?.parentElement
  while (cur && cur !== document.documentElement) {
    const cs = getComputedStyle(cur)
    const oy = cs.overflowY
    const canScroll =
      (oy === "auto" || oy === "scroll") &&
      cur.scrollHeight > cur.clientHeight + 2
    if (canScroll) return cur as HTMLElement
    cur = cur.parentElement
  }
  return null
}

export function findScrollContainer(): HTMLElement | null {
  return (
    // document.querySelector<HTMLElement>("main > div > div:nth-child(2)") ||
    document.querySelector<HTMLElement>("main > div") ||
    (document.scrollingElement as HTMLElement) ||
    document.documentElement
  )
}

export function getChainFromNode(node: Element): string | null {
  if (!(node instanceof HTMLAnchorElement)) return null

  if (!node.classList.contains("ds-dex-table-row")) return null
  if (!node.href) return null

  // Pull chain from the URL
  try {
    const url = new URL(node.href, location.origin)
    const segs = url.pathname.split("/").filter(Boolean)
    return segs[0]?.toLowerCase() ?? null // e.g. "ethereum", "bsc", etc.
  } catch {
    // Fallback for edge-cases
    const href = node.getAttribute("href") || ""
    const clean = href.split("#")[0].split("?")[0]
    const parts = clean.split("/").filter(Boolean)
    return parts[1]?.toLowerCase() ?? null // e.g. "ethereum", "bsc", etc.
  }
}

export function getPairFromNode(node: Element): string | null {
  if (!(node instanceof HTMLAnchorElement)) return null
  if (!node.classList.contains("ds-dex-table-row")) return null
  if (!node.href) return null
  if (!node.querySelector(".ds-dex-table-row-base-token-symbol")) return null
  if (!node.querySelector(".ds-dex-table-row-quote-token-symbol")) return null

  const symbol = node.querySelector(
    ".ds-dex-table-row-base-token-symbol"
  )?.textContent
  const quoteToken = node.querySelector(
    ".ds-dex-table-row-quote-token-symbol"
  )?.textContent

  return `${symbol ? `${symbol}` : ""}${quoteToken ? `/${quoteToken}` : ""}`
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
