const C: Record<string, [string, string]> = {
  USDC: ["#2775CA", "$"], USDT: ["#26A17B", "₮"], NEAR: ["#0B0D12", "N"], ETH: ["#627EEA", "Ξ"], eth: ["#627EEA", "Ξ"], arb: ["#28A0F0", "A"], base: ["#0052FF", "B"],
  sol: ["linear-gradient(135deg,#9945FF,#14F195)", ""], near: ["#0B0D12", "N"], pol: ["#8247E5", "P"], bsc: ["#F0B90B", "B"], op: ["#FF0420", "O"],
  avax: ["#E84142", "A"], ton: ["#0098EA", "T"], tron: ["#EB0029", "T"], gnosis: ["#04795B", "G"], wNEAR: ["#0B0D12", "N"], BTC: ["#F7931A", "₿"],
};
export function TokenIcon({ k, size = 26 }: { k: string; size?: number }) {
  const [bg, ch] = C[k] ?? ["#9aa0aa", k.slice(0, 1).toUpperCase()];
  return <span className="grid shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ width: size, height: size, background: bg }}>{ch}</span>;
}
