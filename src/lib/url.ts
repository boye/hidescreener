// Parse chain and id from a Dexscreener href like /ethereum/<id>
export function parseChainAndIdFromHref(
  href: string
): { chain: string; id: string } | null {
  try {
    const url = new URL(href, location.origin)
    const segs = url.pathname.split("/").filter(Boolean)
    if (segs.length >= 2)
      return { chain: segs[0].toLowerCase(), id: segs[1].toLowerCase() }
    return null
  } catch {
    const clean = (href || "").split("#")[0].split("?")[0]
    const parts = clean.split("/").filter(Boolean)
    if (parts.length >= 2)
      return { chain: parts[0].toLowerCase(), id: parts[1].toLowerCase() }
    return null
  }
}

export function buildEmbedUrl(chain: string, id: string): string {
  const params = new URLSearchParams({
    embed: "1",
    loadChartSettings: "0",
    trades: "0",
    tabs: "0",
    info: "0",
    chartLeftToolbar: "0",
    chartDefaultOnMobile: "1",
    chartTheme: "dark",
    theme: "dark",
    chartStyle: "1",
    chartType: "usd",
    interval: "15"
  })
  return `https://dexscreener.com/${chain}/${id}?${params.toString()}`
}
