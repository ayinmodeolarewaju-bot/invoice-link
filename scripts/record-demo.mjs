// Records the mock flow at 1920x1080 for the demo video. Writes demo/raw/*.webm + marks.json
import { chromium } from "playwright-core"; import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3000"; const OUT = "../demo/raw";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } });
const page = await ctx.newPage(); const t0 = Date.now(); const marks = {};
const mark = (k) => { marks[k] = (Date.now() - t0) / 1000; console.log(k, marks[k]); };
const w = (ms) => page.waitForTimeout(ms);
// visible cursor
await page.addInitScript(() => { addEventListener("DOMContentLoaded", () => { const c = document.createElement("div"); c.id = "cur"; Object.assign(c.style, { position: "fixed", width: "22px", height: "22px", borderRadius: "50%", background: "rgba(110,91,255,.35)", border: "2px solid #6E5BFF", pointerEvents: "none", zIndex: 99999, left: "-50px", top: "-50px", transform: "translate(-50%,-50%)", transition: "left .45s cubic-bezier(.22,1,.36,1), top .45s cubic-bezier(.22,1,.36,1)" }); document.body.appendChild(c); addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }); }); });
async function go(loc) { const b = await loc.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); await w(350); await loc.click(); }
await page.goto(BASE); await page.getByText("Connect NEAR wallet").waitFor(); await w(1500); mark("builder");
const client = page.locator("input.field").first(); await go(client); await client.fill(""); await client.pressSequentially("Northwind Labs GmbH", { delay: 55 }); await w(500);
const a2 = page.getByLabel("Amount 2"); await go(a2); await a2.fill(""); await a2.pressSequentially("100", { delay: 120 }); await w(1200);
mark("create"); await go(page.getByText("Create pay link →")); await page.getByTestId("paylink").waitFor(); await w(2800);
const url = await page.getByTestId("paylink").textContent();
mark("pay"); await page.goto(url.trim()); await w(3500);
await go(page.getByRole("button", { name: /^Pay / })); await page.getByText("You send").waitFor(); mark("pick"); await w(1500);
await go(page.getByRole("button", { name: "USDC" })); await w(1800);
await go(page.getByRole("button", { name: "USDT" })); await w(800);
await go(page.getByRole("button", { name: "Arbitrum" })); await page.getByText("~ 45 sec").first().waitFor(); await w(3000); mark("quote");
await go(page.getByRole("button", { name: "Get deposit address" })); await page.getByText("Send exactly").waitFor(); mark("deposit"); await w(4500);
await go(page.getByRole("button", { name: /Simulate deposit/ })); await page.getByText("Payment in progress").waitFor(); mark("status");
await page.waitForURL(/\/receipt\//, { timeout: 30000 }); mark("receipt"); await w(3500);
await page.mouse.move(960, 700, { steps: 20 }); await w(4000); mark("end");
await ctx.close(); await browser.close();
const vid = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm")).map((f) => `${OUT}/${f}`).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
fs.renameSync(vid, `${OUT}/flow.webm`); fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks, null, 1)); console.log("done", marks);
