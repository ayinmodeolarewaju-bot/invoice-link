// Screenshots of LIVE dry quotes in the real pay UI. Run the app with MOCK_1CLICK=0 first.
// Only dry quotes are requested (the "Get deposit address" button is never clicked), so no deposit address exists and no funds can move.
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const REFUND = { arb: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", eth: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", sol: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" };
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE); await page.getByText("Create pay link →").waitFor({ timeout: 60000 });
await page.getByText("Create pay link →").click(); await page.getByTestId("paylink").waitFor();
const id = (await page.getByTestId("paylink").textContent()).split("/pay/")[1];
await page.goto(`${BASE}/pay/${id}`); await page.getByRole("button", { name: /^Pay / }).click(); await page.getByText("You send").waitFor();
for (const [n, sym, chain, label] of [["09-live-quote-usdt-arb", "USDT", "arb", "Arbitrum"], ["10-live-quote-eth-eth", "ETH", "eth", "Ethereum"], ["11-live-quote-usdc-sol", "USDC", "sol", "Solana"]]) {
  await page.locator("button").filter({ hasText: new RegExp(`${sym}\\s*$`) }).first().click();
  await page.locator("button").filter({ hasText: new RegExp(`${label}\\s*$`) }).first().click();
  const input = page.locator("input.field.font-mono"); await input.fill(REFUND[chain]);
  await page.getByText("Live 1-Click quote").waitFor();
  await page.waitForFunction(() => /~ \d+ sec/.test(document.body.innerText), null, { timeout: 30000 });
  // let the debounced dry quote for this exact token/chain land (the old amount stays dimmed while loading)
  await page.waitForResponse((r) => r.url().endsWith("/api/oneclick/quote"), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000); await page.screenshot({ path: `shots/${n}.png` }); console.log("saved", n);
}
await browser.close();
