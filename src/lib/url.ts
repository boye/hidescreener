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
